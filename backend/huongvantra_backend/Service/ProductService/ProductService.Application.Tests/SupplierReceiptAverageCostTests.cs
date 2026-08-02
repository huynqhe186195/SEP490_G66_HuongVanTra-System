using HuongVanTra.Shared.Messages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.Messaging;
using Xunit;

namespace ProductService.Application.Tests;

public sealed class SupplierReceiptAverageCostTests
{
    [Theory]
    [InlineData(0, 0, 120000, 120000)]
    [InlineData(-1, 0, 120000, 120000)]
    [InlineData(32, 14400, 0, 450)]
    [InlineData(3, 100001, 0, 33333.67)]
    public void CalculateWeightedAverageCost_DividesTotalValueByTotalQuantity(
        decimal totalQuantity,
        decimal totalValue,
        decimal fallbackCostPrice,
        decimal expected)
    {
        Assert.Equal(
            expected,
            SupplierReceiptApprovedCostRecordedConsumer.CalculateWeightedAverageCost(
                totalQuantity,
                totalValue,
                fallbackCostPrice));
    }

    [Fact]
    public async Task WeightedAverageCost_AccumulatesQuantityAndValueAcrossReceipts()
    {
        var skuId = Guid.NewGuid();
        var store = new TestCostStore(0m, skuId);
        var baseAt = DateTime.UtcNow.AddMinutes(-10);

        await CreateConsumer(store).ProcessAsync(
            Event(Guid.NewGuid(), skuId, 1, 1, 300m, baseAt) with { ActualQuantity = 10 });
        await CreateConsumer(store).ProcessAsync(
            Event(Guid.NewGuid(), skuId, 1, 1, 400m, baseAt.AddMinutes(1)) with { ActualQuantity = 9 });
        await CreateConsumer(store).ProcessAsync(
            Event(Guid.NewGuid(), skuId, 1, 1, 600m, baseAt.AddMinutes(2)) with { ActualQuantity = 13 });

        Assert.Equal(32m, store.Variant.TotalApprovedInboundQuantity);
        Assert.Equal(14400m, store.Variant.TotalApprovedInboundValue);
        Assert.Equal(450m, store.Variant.CostPrice);
    }

    [Fact]
    public void CostHistoryModel_UsesDurableUniqueInboxKeys()
    {
        var options = new DbContextOptionsBuilder<ProductDbContext>()
            .UseInMemoryDatabase($"product-cost-{Guid.NewGuid():N}")
            .Options;
        using var db = new ProductDbContext(options);
        var entity = db.Model.FindEntityType(typeof(ProductCostPriceHistory))!;

        Assert.Contains(entity.GetIndexes(), index =>
            index.IsUnique
            && index.Properties.Select(property => property.Name)
                .SequenceEqual([nameof(ProductCostPriceHistory.EventId)]));
        Assert.Contains(entity.GetIndexes(), index =>
            index.IsUnique
            && index.Properties.Select(property => property.Name)
                .SequenceEqual([nameof(ProductCostPriceHistory.SourceReceiptLineId)]));
    }

    [Fact]
    public async Task ProcessingOrder_BeginsReadCommittedAndLocksSkuBeforeEveryRead()
    {
        var store = new TestCostStore(300m);
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(Event(order: 0, count: 0, unitCost: 400m));

        Assert.Equal("Begin:ReadCommitted", store.Calls[0]);
        Assert.Equal("LockSku", store.Calls[1]);
        Assert.True(store.Calls.IndexOf("LockSku") < store.Calls.IndexOf("FindHistory"));
        Assert.True(store.Calls.IndexOf("LockSku") < store.Calls.IndexOf("GetReceiptGroup"));
        Assert.True(store.Calls.IndexOf("LockSku") < store.Calls.IndexOf("GetLatestApplied"));
    }

    [Fact]
    public async Task ConcurrentDelivery_SameReceiptAndSku_IsSerializedAndAppliedInLineOrder()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var approvedAt = DateTime.UtcNow;
        var store = new TestCostStore(300m, skuId);
        var consumer = CreateConsumer(store);

        await Task.WhenAll(
            consumer.ProcessAsync(Event(receiptId, skuId, 1, 2, 400m, approvedAt)),
            consumer.ProcessAsync(Event(receiptId, skuId, 2, 2, 600m, approvedAt)));

        Assert.Equal(2, store.Histories.Count);
        Assert.All(store.Histories, history =>
        {
            Assert.True(history.WasApplied);
            Assert.Equal("applied", history.ProcessingResult);
        });
        Assert.Equal(500m, store.Variant.CostPrice);
        Assert.Equal(
            [(300m, 400m), (400m, 500m)],
            store.Histories
                .OrderBy(history => history.ReceiptLineOrder)
                .Select(history => (history.OldCostPrice, history.NewCostPrice))
                .ToList());
    }

    [Fact]
    public async Task ReverseArrival_WaitsForLineOneThenAppliesOneThroughTwo()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var approvedAt = DateTime.UtcNow;
        var store = new TestCostStore(300m, skuId);
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(Event(receiptId, skuId, 2, 2, 600m, approvedAt));

        Assert.Equal(300m, store.Variant.CostPrice);
        Assert.Equal("sequence_incomplete", store.Histories.Single().ProcessingResult);

        await consumer.ProcessAsync(Event(receiptId, skuId, 1, 2, 400m, approvedAt));

        Assert.Equal(500m, store.Variant.CostPrice);
        Assert.All(store.Histories, history => Assert.Equal("applied", history.ProcessingResult));
    }

    [Fact]
    public async Task DuplicateIncompleteEvent_ReevaluatesExistingGroupWithoutCreatingHistory()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var approvedAt = DateTime.UtcNow;
        var lineOne = Event(receiptId, skuId, 1, 2, 400m, approvedAt);
        var lineTwo = Event(receiptId, skuId, 2, 2, 600m, approvedAt);
        var store = new TestCostStore(300m, skuId);
        store.SeedHistory(lineOne, "sequence_incomplete");
        store.SeedHistory(lineTwo, "sequence_incomplete");
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(lineOne);

        Assert.Equal(2, store.Histories.Count);
        Assert.Equal(500m, store.Variant.CostPrice);
        Assert.All(store.Histories, history =>
        {
            Assert.True(history.WasApplied);
            Assert.Equal("applied", history.ProcessingResult);
        });
    }

    [Fact]
    public async Task DuplicateTerminalEvent_IsIdempotentNoOp()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var approvedAt = DateTime.UtcNow;
        var lineOne = Event(receiptId, skuId, 1, 2, 400m, approvedAt);
        var lineTwo = Event(receiptId, skuId, 2, 2, 600m, approvedAt);
        var store = new TestCostStore(300m, skuId);
        var consumer = CreateConsumer(store);
        await consumer.ProcessAsync(lineOne);
        await consumer.ProcessAsync(lineTwo);
        var beforeCalls = store.Calls.Count;

        await consumer.ProcessAsync(lineOne);

        Assert.Equal(2, store.Histories.Count);
        Assert.Equal(500m, store.Variant.CostPrice);
        Assert.DoesNotContain(
            "SaveChanges",
            store.Calls.Skip(beforeCalls));
    }

    [Fact]
    public async Task DifferentReceipts_DoNotMixTheirSequenceGroups()
    {
        var skuId = Guid.NewGuid();
        var receiptOne = Guid.NewGuid();
        var receiptTwo = Guid.NewGuid();
        var store = new TestCostStore(300m, skuId);
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(Event(receiptOne, skuId, 1, 2, 400m));
        await consumer.ProcessAsync(Event(receiptTwo, skuId, 1, 2, 800m));
        await consumer.ProcessAsync(Event(receiptOne, skuId, 2, 2, 600m));

        Assert.Equal(500m, store.Variant.CostPrice);
        Assert.All(
            store.Histories.Where(history => history.SourceReceiptId == receiptOne),
            history => Assert.Equal("applied", history.ProcessingResult));
        Assert.Equal(
            "sequence_incomplete",
            store.Histories.Single(history => history.SourceReceiptId == receiptTwo)
                .ProcessingResult);
    }

    [Fact]
    public async Task OlderReceiptArrivingLate_IsSupersededByNewerAppliedReceipt()
    {
        var skuId = Guid.NewGuid();
        var olderAt = DateTime.UtcNow.AddMinutes(-1);
        var newerAt = DateTime.UtcNow;
        var newerReceipt = Guid.NewGuid();
        var olderReceipt = Guid.NewGuid();
        var store = new TestCostStore(300m, skuId);
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(Event(newerReceipt, skuId, 1, 1, 600m, newerAt));
        await consumer.ProcessAsync(Event(olderReceipt, skuId, 1, 1, 400m, olderAt));

        Assert.Equal(600m, store.Variant.CostPrice);
        var olderHistory = store.Histories.Single(
            history => history.SourceReceiptId == olderReceipt);
        Assert.False(olderHistory.WasApplied);
        Assert.Equal("superseded", olderHistory.ProcessingResult);
        Assert.Equal(olderHistory.TotalQuantityBefore, olderHistory.TotalQuantityAfter);
        Assert.Equal(olderHistory.TotalValueBefore, olderHistory.TotalValueAfter);
    }

    [Fact]
    public void SameApprovalTimestamp_UsesReceiptIdAsDeterministicTieBreaker()
    {
        var approvedAt = DateTime.UtcNow;
        var lowerReceiptId = Guid.Parse("10000000-0000-0000-0000-000000000000");
        var higherReceiptId = Guid.Parse("20000000-0000-0000-0000-000000000000");

        Assert.True(
            SupplierReceiptApprovedCostRecordedConsumer.CompareBusinessOrder(
                approvedAt,
                lowerReceiptId,
                approvedAt,
                higherReceiptId) < 0);
    }

    [Theory]
    [MemberData(nameof(InvalidSequences))]
    public void SequenceValidation_RejectsConflictingOrDuplicateMetadata(
        List<ProductCostPriceHistory> histories)
    {
        var validation =
            SupplierReceiptApprovedCostRecordedConsumer.EvaluateReceiptSequence(histories);

        Assert.Equal(
            SupplierReceiptApprovedCostRecordedConsumer.ReceiptSequenceState.Invalid,
            validation.State);
    }

    public static IEnumerable<object[]> InvalidSequences()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var duplicateLineId = Guid.NewGuid();
        yield return
        [
            new List<ProductCostPriceHistory>
            {
                History(receiptId, skuId, Guid.NewGuid(), 1, 2),
                History(receiptId, skuId, Guid.NewGuid(), 1, 2)
            }
        ];
        yield return
        [
            new List<ProductCostPriceHistory>
            {
                History(receiptId, skuId, Guid.NewGuid(), 1, 2),
                History(receiptId, skuId, Guid.NewGuid(), 2, 3)
            }
        ];
        yield return
        [
            new List<ProductCostPriceHistory>
            {
                History(receiptId, skuId, duplicateLineId, 1, 2),
                History(receiptId, skuId, duplicateLineId, 2, 2)
            }
        ];
        yield return
        [
            new List<ProductCostPriceHistory>
            {
                History(receiptId, skuId, Guid.NewGuid(), 1, 2),
                History(receiptId, skuId, Guid.NewGuid(), 3, 2)
            }
        ];
    }

    [Fact]
    public async Task InvalidSequence_BecomesTerminalAndDoesNotUpdateCost()
    {
        var receiptId = Guid.NewGuid();
        var skuId = Guid.NewGuid();
        var store = new TestCostStore(300m, skuId);
        var first = Event(receiptId, skuId, 1, 2, 400m);
        store.SeedHistory(first, "sequence_incomplete");
        var consumer = CreateConsumer(store);

        await consumer.ProcessAsync(Event(receiptId, skuId, 1, 2, 600m));

        Assert.Equal(300m, store.Variant.CostPrice);
        Assert.All(
            store.Histories,
            history => Assert.Equal("sequence_invalid", history.ProcessingResult));
    }

    [Fact]
    public async Task LegacyOneByOneEvent_AppliesExactlyOnce()
    {
        var store = new TestCostStore(300m);
        var consumer = CreateConsumer(store);
        var legacy = Event(order: 0, count: 0, unitCost: 400m);

        await consumer.ProcessAsync(legacy);
        await consumer.ProcessAsync(legacy);

        Assert.Single(store.Histories);
        Assert.Equal(400m, store.Variant.CostPrice);
        Assert.Equal("applied", store.Histories[0].ProcessingResult);
    }

    [Fact]
    public async Task ActualQuantity_WeightsAverageCost()
    {
        var firstStore = new TestCostStore(0m);
        var secondStore = new TestCostStore(0m, firstStore.Variant.Id);
        var lightEvent = Event(order: 1, count: 1, unitCost: 500m) with
        {
            ActualQuantity = 1
        };
        var heavyEvent = lightEvent with
        {
            EventId = Guid.NewGuid(),
            SupplierReceiptId = Guid.NewGuid(),
            SupplierReceiptLineId = Guid.NewGuid(),
            ActualQuantity = 999
        };

        await CreateConsumer(firstStore).ProcessAsync(lightEvent);
        await CreateConsumer(secondStore).ProcessAsync(heavyEvent);

        Assert.Equal(1m, firstStore.Variant.TotalApprovedInboundQuantity);
        Assert.Equal(500m, firstStore.Variant.TotalApprovedInboundValue);
        Assert.Equal(999m, secondStore.Variant.TotalApprovedInboundQuantity);
        Assert.Equal(499500m, secondStore.Variant.TotalApprovedInboundValue);
    }

    [Fact]
    public async Task SaveFailure_RollsBackHistoryAndVariantAtomically()
    {
        var store = new TestCostStore(300m)
        {
            ThrowOnSave = true
        };
        var consumer = CreateConsumer(store);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => consumer.ProcessAsync(Event(order: 1, count: 1, unitCost: 400m)));

        Assert.Empty(store.Histories);
        Assert.Equal(300m, store.Variant.CostPrice);
        Assert.Contains("Rollback", store.Calls);
    }

    [Fact]
    public void ReceiptSequence_ReverseArrival_IsCompleteOnlyAfterEveryLineExists()
    {
        Assert.False(
            SupplierReceiptApprovedCostRecordedConsumer.HasCompleteReceiptSequence(
                [(2, 2)]));
        Assert.True(
            SupplierReceiptApprovedCostRecordedConsumer.HasCompleteReceiptSequence(
                [(2, 2), (1, 2)]));
    }

    [Fact]
    public void ReceiptSequence_LegacyEventDefaults_AreComplete()
    {
        Assert.True(
            SupplierReceiptApprovedCostRecordedConsumer.HasCompleteReceiptSequence(
                [(1, 1)]));
    }

    [Fact]
    public void ReceiptSequence_DuplicateOrMissingOrder_IsNotComplete()
    {
        Assert.False(
            SupplierReceiptApprovedCostRecordedConsumer.HasCompleteReceiptSequence(
                [(1, 2), (1, 2)]));
        Assert.False(
            SupplierReceiptApprovedCostRecordedConsumer.HasCompleteReceiptSequence(
                [(1, 3), (2, 3)]));
    }

    private static SupplierReceiptApprovedCostRecordedConsumer CreateConsumer(
        ISupplierReceiptCostStore store) =>
        new(
            store,
            NullLogger<SupplierReceiptApprovedCostRecordedConsumer>.Instance);

    private static SupplierReceiptApprovedCostRecordedEvent Event(
        Guid? receiptId = null,
        Guid? skuId = null,
        int order = 1,
        int count = 1,
        decimal unitCost = 400m,
        DateTime? approvedAt = null) =>
        new()
        {
            EventId = Guid.NewGuid(),
            SupplierReceiptId = receiptId ?? Guid.NewGuid(),
            SupplierReceiptLineId = Guid.NewGuid(),
            ReceiptCode = "NCC-UAT",
            ApprovedAt = approvedAt ?? DateTime.UtcNow,
            SkuId = skuId ?? TestCostStore.DefaultSkuId,
            SkuCode = "UAT-SKU",
            ActualQuantity = 10,
            UnitCost = unitCost,
            ReceiptLineOrder = order,
            ReceiptSkuLineCount = count
        };

    private static ProductCostPriceHistory History(
        Guid receiptId,
        Guid skuId,
        Guid lineId,
        int order,
        int count) =>
        new()
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid(),
            SkuId = skuId,
            OldCostPrice = 300m,
            IncomingUnitCost = 400m,
            NewCostPrice = 300m,
            SourceReceiptId = receiptId,
            SourceReceiptLineId = lineId,
            SourceReceiptCode = "NCC-UAT",
            SourceApprovedAt = DateTime.UtcNow,
            ReceiptLineOrder = order,
            ReceiptSkuLineCount = count,
            ProcessingResult = "sequence_incomplete",
            UpdatedAt = DateTime.UtcNow
        };

    private sealed class TestCostStore : ISupplierReceiptCostStore
    {
        public static readonly Guid DefaultSkuId =
            Guid.Parse("99999999-0000-4000-8000-000000000001");

        private readonly SemaphoreSlim _skuLock = new(1, 1);
        private readonly object _callSync = new();
        private readonly List<ProductCostPriceHistory> _pendingHistories = [];
        private TransactionSnapshot? _snapshot;
        private bool _lockHeld;

        public TestCostStore(decimal costPrice, Guid? skuId = null)
        {
            Variant = new ProductVariant
            {
                Id = skuId ?? DefaultSkuId,
                ProductId = Guid.NewGuid(),
                SkuCode = "UAT-SKU",
                VariantName = "UAT SKU",
                CostPrice = costPrice
            };
        }

        public ProductVariant Variant { get; }
        public List<ProductCostPriceHistory> Histories { get; } = [];
        public List<string> Calls { get; } = [];
        public bool ThrowOnSave { get; init; }

        public async Task ExecuteReadCommittedAsync(
            Func<CancellationToken, Task> operation,
            CancellationToken cancellationToken)
        {
            Record("Begin:ReadCommitted");
            try
            {
                await operation(cancellationToken);
                Record("Commit");
            }
            catch
            {
                if (_snapshot is not null)
                    Restore(_snapshot);
                Record("Rollback");
                throw;
            }
            finally
            {
                _snapshot = null;
                if (_lockHeld)
                {
                    _lockHeld = false;
                    _skuLock.Release();
                }
            }
        }

        public async Task<ProductVariant?> LockVariantAsync(
            Guid skuId,
            CancellationToken cancellationToken)
        {
            await _skuLock.WaitAsync(cancellationToken);
            _lockHeld = true;
            _snapshot = new TransactionSnapshot(
                Variant.CostPrice,
                Variant.TotalApprovedInboundQuantity,
                Variant.TotalApprovedInboundValue,
                Variant.UpdatedAt,
                Histories.Select(Clone).ToList());
            Record("LockSku");
            return Variant.Id == skuId ? Variant : null;
        }

        public Task<ProductCostPriceHistory?> FindHistoryAsync(
            Guid eventId,
            Guid sourceReceiptLineId,
            CancellationToken cancellationToken)
        {
            AssertLocked();
            Record("FindHistory");
            return Task.FromResult(
                Histories.SingleOrDefault(
                    history =>
                        history.EventId == eventId
                        || history.SourceReceiptLineId == sourceReceiptLineId));
        }

        public Task<List<ProductCostPriceHistory>> GetReceiptGroupAsync(
            Guid sourceReceiptId,
            Guid skuId,
            CancellationToken cancellationToken)
        {
            AssertLocked();
            Record("GetReceiptGroup");
            return Task.FromResult(
                Histories
                    .Where(history =>
                        history.SourceReceiptId == sourceReceiptId
                        && history.SkuId == skuId)
                    .OrderBy(history => history.ReceiptLineOrder)
                    .ThenBy(history => history.SourceReceiptLineId)
                    .ToList());
        }

        public Task<ProductCostPriceHistory?> GetLatestAppliedHistoryAsync(
            Guid skuId,
            CancellationToken cancellationToken)
        {
            AssertLocked();
            Record("GetLatestApplied");
            return Task.FromResult(
                Histories
                    .Where(history => history.SkuId == skuId && history.WasApplied)
                    .OrderByDescending(history => history.SourceApprovedAt)
                    .ThenByDescending(history => history.SourceReceiptId)
                    .ThenByDescending(history => history.ReceiptLineOrder)
                    .FirstOrDefault());
        }

        // Reconciliation đọc ngoài transaction lock nên không AssertLocked.
        public Task<List<Guid>> GetActiveVariantIdsAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new List<Guid> { Variant.Id });

        public Task<List<ProductCostPriceHistory>> GetAppliedHistoryForSkuAsync(
            Guid skuId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                Histories
                    .Where(history =>
                        history.SkuId == skuId
                        && history.WasApplied
                        && history.IncomingQuantity > 0
                        && history.IncomingUnitCost > 0)
                    .OrderBy(history => history.SourceApprovedAt)
                    .ThenBy(history => history.SourceReceiptId)
                    .ThenBy(history => history.ReceiptLineOrder)
                    .ThenBy(history => history.SourceReceiptLineId)
                    .ToList());

        public Task<List<Guid>> GetPendingReconciliationReceiptIdsAsync(
            Guid skuId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                Histories
                    .Where(history =>
                        history.SkuId == skuId
                        && !history.WasApplied
                        && history.ProcessingResult == "reconciliation_required")
                    .GroupBy(history => history.SourceReceiptId)
                    .Select(group => new
                    {
                        SourceReceiptId = group.Key,
                        ApprovedAt = group.Min(history => history.SourceApprovedAt)
                    })
                    .OrderBy(group => group.ApprovedAt)
                    .ThenBy(group => group.SourceReceiptId.ToString("D"), StringComparer.Ordinal)
                    .Select(group => group.SourceReceiptId)
                    .ToList());

        public void AddHistory(ProductCostPriceHistory history)
        {
            AssertLocked();
            Record("AddHistory");
            _pendingHistories.Add(history);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            AssertLocked();
            Record("SaveChanges");
            if (ThrowOnSave)
                throw new InvalidOperationException("Simulated SaveChanges failure.");
            Histories.AddRange(_pendingHistories);
            _pendingHistories.Clear();
            return Task.CompletedTask;
        }

        public void SeedHistory(
            SupplierReceiptApprovedCostRecordedEvent message,
            string processingResult)
        {
            Histories.Add(new ProductCostPriceHistory
            {
                Id = Guid.NewGuid(),
                EventId = message.EventId,
                SkuId = message.SkuId,
                OldCostPrice = Variant.CostPrice,
                IncomingUnitCost = message.UnitCost,
                IncomingQuantity = message.ActualQuantity,
                IncomingValue = message.ActualQuantity * message.UnitCost,
                NewCostPrice = Variant.CostPrice,
                SourceReceiptId = message.SupplierReceiptId,
                SourceReceiptLineId = message.SupplierReceiptLineId,
                SourceReceiptCode = message.ReceiptCode,
                SourceApprovedAt = message.ApprovedAt,
                ReceiptLineOrder = message.ReceiptLineOrder > 0 ? message.ReceiptLineOrder : 1,
                ReceiptSkuLineCount =
                    message.ReceiptSkuLineCount > 0 ? message.ReceiptSkuLineCount : 1,
                WasApplied = false,
                ProcessingResult = processingResult,
                UpdatedAt = DateTime.UtcNow
            });
        }

        private void AssertLocked()
        {
            if (!_lockHeld)
                throw new InvalidOperationException("A database read occurred before LockVariant.");
        }

        private void Record(string call)
        {
            lock (_callSync)
                Calls.Add(call);
        }

        private void Restore(TransactionSnapshot snapshot)
        {
            Variant.CostPrice = snapshot.CostPrice;
            Variant.TotalApprovedInboundQuantity = snapshot.TotalQuantity;
            Variant.TotalApprovedInboundValue = snapshot.TotalValue;
            Variant.UpdatedAt = snapshot.UpdatedAt;
            _pendingHistories.Clear();
            Histories.Clear();
            Histories.AddRange(snapshot.Histories.Select(Clone));
        }

        private static ProductCostPriceHistory Clone(ProductCostPriceHistory history) =>
            new()
            {
                Id = history.Id,
                EventId = history.EventId,
                SkuId = history.SkuId,
                OldCostPrice = history.OldCostPrice,
                IncomingUnitCost = history.IncomingUnitCost,
                IncomingQuantity = history.IncomingQuantity,
                IncomingValue = history.IncomingValue,
                TotalQuantityBefore = history.TotalQuantityBefore,
                TotalQuantityAfter = history.TotalQuantityAfter,
                TotalValueBefore = history.TotalValueBefore,
                TotalValueAfter = history.TotalValueAfter,
                NewCostPrice = history.NewCostPrice,
                SourceType = history.SourceType,
                SourceReceiptId = history.SourceReceiptId,
                SourceReceiptLineId = history.SourceReceiptLineId,
                SourceReceiptCode = history.SourceReceiptCode,
                SourceApprovedAt = history.SourceApprovedAt,
                ReceiptLineOrder = history.ReceiptLineOrder,
                ReceiptSkuLineCount = history.ReceiptSkuLineCount,
                WasApplied = history.WasApplied,
                ProcessingResult = history.ProcessingResult,
                UpdatedAt = history.UpdatedAt,
                UpdatedBy = history.UpdatedBy
            };

        private sealed record TransactionSnapshot(
            decimal CostPrice,
            decimal TotalQuantity,
            decimal TotalValue,
            DateTime? UpdatedAt,
            List<ProductCostPriceHistory> Histories);
    }
}
