using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Messaging;

/// <summary>
/// ProductService-owned average cost calculation. The durable history row is
/// both the audit record and the DB-backed Inbox key for a receipt line.
/// </summary>
public sealed class SupplierReceiptApprovedCostRecordedConsumer(
    ISupplierReceiptCostStore store,
    ILogger<SupplierReceiptApprovedCostRecordedConsumer> logger)
    : IConsumer<SupplierReceiptApprovedCostRecordedEvent>
{
    public enum ReceiptSequenceState
    {
        Incomplete,
        Complete,
        Invalid
    }

    public sealed record ReceiptSequenceValidation(
        ReceiptSequenceState State,
        int ExpectedCount,
        int ActualCount,
        IReadOnlyList<int> Orders);

    public async Task Consume(ConsumeContext<SupplierReceiptApprovedCostRecordedEvent> context) =>
        await ProcessAsync(context.Message, context.CancellationToken);

    public async Task ProcessAsync(
        SupplierReceiptApprovedCostRecordedEvent message,
        CancellationToken cancellationToken = default)
    {
        if (message.EventId == Guid.Empty
            || message.SupplierReceiptId == Guid.Empty
            || message.SupplierReceiptLineId == Guid.Empty
            || message.SkuId == Guid.Empty
            || message.ActualQuantity <= 0
            || message.UnitCost <= 0)
        {
            logger.LogWarning(
                "Acknowledging invalid Supplier Receipt cost event {EventId}; no CostPrice mutation was made.",
                message.EventId);
            return;
        }

        try
        {
            await store.ExecuteReadCommittedAsync(async ct =>
            {
                // This must remain the first database operation after the
                // ReadCommitted transaction begins.
                var variant = await store.LockVariantAsync(message.SkuId, ct);
                if (variant is null)
                {
                    logger.LogError(
                        "Cannot process Supplier Receipt cost event {EventId}: ProductVariant {SkuId} was not found.",
                        message.EventId,
                        message.SkuId);
                    throw new InvalidOperationException(
                        $"Không tìm thấy ProductVariant {message.SkuId} để cập nhật giá vốn.");
                }

                var existing = await store.FindHistoryAsync(
                    message.EventId,
                    message.SupplierReceiptLineId,
                    ct);
                if (existing is not null)
                {
                    if (existing.SkuId != message.SkuId
                        || existing.SourceReceiptId != message.SupplierReceiptId)
                    {
                        logger.LogError(
                            "Supplier Receipt cost event identity collision. EventId {EventId}, ReceiptId {ReceiptId}, SkuId {SkuId}.",
                            message.EventId,
                            message.SupplierReceiptId,
                            message.SkuId);
                        throw new InvalidOperationException(
                            $"Event {message.EventId} trùng idempotency key với một cost history khác.");
                    }

                    if (IsTerminal(existing))
                        return;
                }

                var history = existing ?? CreateHistory(message, variant.CostPrice);
                var isNewHistory = existing is null;
                if (isNewHistory)
                    store.AddHistory(history);

                // The persisted rows use SourceReceiptId + SkuId as the group
                // key. A newly tracked history is appended because SaveChanges
                // intentionally happens once, after the whole group is decided.
                var group = await store.GetReceiptGroupAsync(
                    history.SourceReceiptId,
                    history.SkuId,
                    ct);
                if (isNewHistory)
                    group.Add(history);

                await EvaluateAndApplyGroupAsync(variant, group, ct);
                await store.SaveChangesAsync(ct);
            }, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Supplier Receipt cost processing failed. EventId {EventId}, ReceiptId {ReceiptId}, SkuId {SkuId}.",
                message.EventId,
                message.SupplierReceiptId,
                message.SkuId);
            throw;
        }
    }

    private static ProductCostPriceHistory CreateHistory(
        SupplierReceiptApprovedCostRecordedEvent message,
        decimal currentCostPrice)
    {
        var receiptLineOrder = message.ReceiptLineOrder > 0
            ? message.ReceiptLineOrder
            : 1;
        var receiptSkuLineCount = message.ReceiptSkuLineCount > 0
            ? message.ReceiptSkuLineCount
            : 1;

        return new ProductCostPriceHistory
        {
            Id = Guid.NewGuid(),
            EventId = message.EventId,
            SkuId = message.SkuId,
            OldCostPrice = currentCostPrice,
            IncomingUnitCost = message.UnitCost,
            NewCostPrice = currentCostPrice,
            SourceType = "supplier_receipt",
            SourceReceiptId = message.SupplierReceiptId,
            SourceReceiptLineId = message.SupplierReceiptLineId,
            SourceReceiptCode = message.ReceiptCode,
            SourceApprovedAt = message.ApprovedAt,
            ReceiptLineOrder = receiptLineOrder,
            ReceiptSkuLineCount = receiptSkuLineCount,
            WasApplied = false,
            ProcessingResult = "waiting_sequence",
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = "supplier-receipt-consumer"
        };
    }

    private async Task EvaluateAndApplyGroupAsync(
        ProductVariant variant,
        List<ProductCostPriceHistory> group,
        CancellationToken cancellationToken)
    {
        var validation = EvaluateReceiptSequence(group);
        if (validation.State == ReceiptSequenceState.Incomplete)
        {
            foreach (var history in group.Where(IsRecoverable))
            {
                history.WasApplied = false;
                history.ProcessingResult = "sequence_incomplete";
                history.UpdatedAt = DateTime.UtcNow;
            }
            return;
        }

        if (validation.State == ReceiptSequenceState.Invalid
            || group.Any(IsTerminal))
        {
            foreach (var history in group.Where(IsRecoverable))
            {
                history.WasApplied = false;
                history.ProcessingResult = "sequence_invalid";
                history.UpdatedAt = DateTime.UtcNow;
            }

            var sourceReceiptId = group.FirstOrDefault()?.SourceReceiptId ?? Guid.Empty;
            logger.LogError(
                "Invalid Supplier Receipt cost sequence. ReceiptId {ReceiptId}, SkuId {SkuId}, ExpectedCount {ExpectedCount}, ActualCount {ActualCount}, Orders {Orders}.",
                sourceReceiptId,
                variant.Id,
                validation.ExpectedCount,
                validation.ActualCount,
                string.Join(",", validation.Orders));
            return;
        }

        var ordered = group
            .OrderBy(history => history.ReceiptLineOrder)
            .ThenBy(history => history.SourceReceiptLineId)
            .ToList();
        var groupApprovedAt = ordered.Min(history => history.SourceApprovedAt);
        var groupReceiptId = ordered[0].SourceReceiptId;
        var latestApplied = await store.GetLatestAppliedHistoryAsync(
            variant.Id,
            cancellationToken);
        var isSuperseded = latestApplied is not null
            && CompareBusinessOrder(
                groupApprovedAt,
                groupReceiptId,
                latestApplied.SourceApprovedAt,
                latestApplied.SourceReceiptId) < 0;
        var updatedAt = DateTime.UtcNow;

        foreach (var history in ordered)
        {
            var oldCostPrice = variant.CostPrice;
            var newCostPrice = isSuperseded
                ? oldCostPrice
                : CalculateAverageCost(oldCostPrice, history.IncomingUnitCost);
            history.OldCostPrice = oldCostPrice;
            history.NewCostPrice = newCostPrice;
            history.WasApplied = !isSuperseded;
            history.ProcessingResult = isSuperseded ? "superseded" : "applied";
            history.UpdatedAt = updatedAt;

            if (!isSuperseded)
                variant.CostPrice = newCostPrice;
        }

        if (!isSuperseded)
            variant.UpdatedAt = updatedAt;
    }

    public static ReceiptSequenceValidation EvaluateReceiptSequence(
        IReadOnlyCollection<ProductCostPriceHistory> lines)
    {
        if (lines.Count == 0)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Incomplete,
                0,
                0,
                []);
        }

        var expectedCounts = lines
            .Select(line => line.ReceiptSkuLineCount)
            .Distinct()
            .ToList();
        var orders = lines
            .Select(line => line.ReceiptLineOrder)
            .OrderBy(order => order)
            .ToList();
        var expectedCount = expectedCounts.Count == 1
            ? expectedCounts[0]
            : expectedCounts.Where(count => count > 0).DefaultIfEmpty(0).Max();
        var hasInvalidMetadata = expectedCounts.Count != 1
            || expectedCount <= 0
            || lines.Select(line => line.SourceReceiptLineId).Distinct().Count() != lines.Count
            || orders.Distinct().Count() != lines.Count
            || orders.Any(order => order <= 0 || order > expectedCount)
            || lines.Count > expectedCount;
        if (hasInvalidMetadata)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Invalid,
                expectedCount,
                lines.Count,
                orders);
        }

        if (lines.Count < expectedCount)
        {
            return new ReceiptSequenceValidation(
                ReceiptSequenceState.Incomplete,
                expectedCount,
                lines.Count,
                orders);
        }

        var isComplete = Enumerable.Range(1, expectedCount).SequenceEqual(orders);
        return new ReceiptSequenceValidation(
            isComplete ? ReceiptSequenceState.Complete : ReceiptSequenceState.Invalid,
            expectedCount,
            lines.Count,
            orders);
    }

    public static int CompareBusinessOrder(
        DateTime leftApprovedAt,
        Guid leftReceiptId,
        DateTime rightApprovedAt,
        Guid rightReceiptId)
    {
        var approvedAtComparison = leftApprovedAt.CompareTo(rightApprovedAt);
        return approvedAtComparison != 0
            ? approvedAtComparison
            : string.CompareOrdinal(
                leftReceiptId.ToString("D"),
                rightReceiptId.ToString("D"));
    }

    private static bool IsRecoverable(ProductCostPriceHistory history) =>
        !history.WasApplied
        && history.ProcessingResult is
            "waiting_sequence"
            or "sequence_incomplete"
            or "pending";

    private static bool IsTerminal(ProductCostPriceHistory history) =>
        history.WasApplied
        || history.ProcessingResult is
            "applied"
            or "superseded"
            or "sequence_invalid"
            or "invalid";

    public static bool HasCompleteReceiptSequence(
        IEnumerable<(int ReceiptLineOrder, int ReceiptSkuLineCount)> lines)
    {
        var sequence = lines.ToList();
        if (sequence.Count == 0)
            return false;

        var expectedCounts = sequence
            .Select(line => line.ReceiptSkuLineCount)
            .Distinct()
            .ToList();
        if (expectedCounts.Count != 1 || expectedCounts[0] <= 0)
            return false;

        var expectedCount = expectedCounts[0];
        var orders = sequence
            .Select(line => line.ReceiptLineOrder)
            .OrderBy(order => order)
            .ToList();
        return sequence.Count == expectedCount
            && Enumerable.Range(1, expectedCount).SequenceEqual(orders);
    }

    public static decimal CalculateAverageCost(decimal currentCostPrice, decimal incomingUnitCost)
    {
        var calculated = currentCostPrice <= 0
            ? incomingUnitCost
            : (currentCostPrice + incomingUnitCost) / 2m;
        return Math.Round(calculated, 2, MidpointRounding.AwayFromZero);
    }
}
