using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// POS-04 (H4) — giữ chỗ tồn Kệ Hàng cho đơn COD chờ xác nhận. Kiểm chứng:
/// giữ chỗ khi vào queue, idempotent, tồn khả bán = OnHand - Reserved,
/// nhả khi hủy, và trừ tồn tiêu thụ đúng phần giữ chỗ của chính queue.
/// Dùng InMemory + repo tồn nền EF thật (không FOR UPDATE) để mô phỏng.
/// </summary>
public sealed class InventoryReservationTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inv-reserve-{Guid.NewGuid():N}")
            .Options);

    /// <summary>
    /// Repo tồn nền EF thật nhưng GetBySkuIdWithLockAsync tránh raw SQL FOR UPDATE
    /// (InMemory không hỗ trợ) — hành vi khoá dòng để dành cho Docker gate.
    /// </summary>
    private sealed class InMemorySkuStockRepository(InventoryDbContext db) : ISkuStockRepository
    {
        public Task<SkuStock?> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == skuId, ct);

        public Task<SkuStock?> GetBySkuIdWithLockAsync(Guid skuId, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == skuId, ct);

        public Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default) =>
            db.SkuStocks.OrderBy(s => s.SkuCode).ToListAsync(ct);

        public async Task AddAsync(SkuStock stock, CancellationToken ct = default) =>
            await db.SkuStocks.AddAsync(stock, ct);

        public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            db.SaveChangesAsync(ct);
    }

    private static InventoryLogic BuildLogic(
        InventoryDbContext db,
        IInventoryEventPublisher? publisher = null,
        bool simulateWarehouse = true)
    {
        var stockRepo = new InMemorySkuStockRepository(db);
        var queueRepo = new StockDeductQueueRepository(db);
        var processed = new ProcessedIntegrationEventRepository(db);

        return new InventoryLogic(
            stockRepo,
            queueRepo,
            Mock.Of<IStockAdjustmentRequestRepository>(),
            new StockExportSlipRepository(db),
            Mock.Of<IStockImportSlipRepository>(),
            new WarehouseBatchRepository(db),
            new StockExportBatchAllocationRepository(db),
            new InventoryLedgerRepository(db),
            Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            processed,
            publisher ?? Mock.Of<IInventoryEventPublisher>(),
            BuildPassThroughUnitOfWork(db),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            Mock.Of<HuongVanTra.Shared.Notifications.INotificationClient>(),
            Microsoft.Extensions.Options.Options.Create(
                new InventoryOptions { SimulateWarehouse = simulateWarehouse }));
    }

    /// <summary>
    /// Pass-through UoW cho mọi T (ConfirmQueue dùng T là type private của InventoryLogic
    /// nên không thể set up qua Moq generic) — thực thi trực tiếp action, không giao dịch thật.
    /// </summary>
    private sealed class PassThroughUnitOfWork : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private static IInventoryUnitOfWork BuildPassThroughUnitOfWork(InventoryDbContext db) =>
        new PassThroughUnitOfWork();

    private static async Task<SkuStock> SeedStockAsync(
        InventoryDbContext db, Guid skuId, int onHand, string code = "SKU-1")
    {
        var stock = new SkuStock
        {
            SkuId = skuId,
            SkuCode = code,
            QuantityOnHand = onHand,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.SkuStocks.Add(stock);
        await db.SaveChangesAsync();
        return stock;
    }

    private static OrderPlacedEvent CodPlaced(Guid orderId, Guid skuId, int qty, string code = "HVT-R1") =>
        new()
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = code,
            OrderStatus = "PendingPayment",
            OrderChannel = "COD",
            TotalAmount = 10_000m,
            Items = new[] { new OrderItemEvent { SkuId = skuId, SkuCode = "SKU-1", Quantity = qty } }
        };

    [Fact]
    public async Task PendingCod_ReservesShelfStock_AndReducesAvailability()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);

        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 3));

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(10, stock.QuantityOnHand);   // tồn vật lý không đổi
        Assert.Equal(3, stock.ReservedQuantity);  // đã giữ chỗ

        var store = await logic.GetStoreSkuStocksAsync();
        var line = store.Single(s => s.SkuId == skuId);
        Assert.Equal(3, line.ReservedQuantity);
        Assert.Equal(7, line.AvailableQuantity);  // khả bán = 10 - 3
    }

    [Fact]
    public async Task Reservation_IsIdempotent_AcrossRedelivery()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();
        var evt = CodPlaced(orderId, skuId, 4);

        await logic.HandleOrderPlacedAsync(evt);
        await logic.HandleOrderPlacedAsync(evt); // cùng EventId → short-circuit

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, stock.ReservedQuantity); // vẫn chỉ giữ 1 lần
    }

    [Fact]
    public async Task CancelBeforeDeduct_ReleasesReservation()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 5));
        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = "HVT-R1",
            Items = new[] { new OrderItemEvent { SkuId = skuId, Quantity = 5 } }
        });

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(10, stock.QuantityOnHand);
        Assert.Equal(0, stock.ReservedQuantity); // đã nhả giữ chỗ
    }

    [Fact]
    public async Task ManualCancelQueue_ReleasesReservation()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 8);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 2));
        var queue = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderId == orderId);

        await logic.CancelQueueAsync(queue.Id, new(Reason: "khách đổi ý"), Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(0, stock.ReservedQuantity);
    }

    [Fact]
    public async Task ConfirmDeduct_ConsumesReservation_AndReducesPhysicalStock()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db, simulateWarehouse: true);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderId == orderId);

        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, stock.QuantityOnHand);    // trừ tồn vật lý 10 - 6
        Assert.Equal(0, stock.ReservedQuantity);  // giữ chỗ đã tiêu thụ hết
    }

    [Fact]
    public async Task OtherReservation_BlocksSellFirstAvailability_ButOwnReservationDeducts()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db, simulateWarehouse: true);

        // Đơn COD A giữ 8 → khả bán còn 2.
        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 8, "HVT-A"));
        var afterReserve = await logic.GetStoreSkuStocksAsync();
        Assert.Equal(2, afterReserve.Single(s => s.SkuId == skuId).AvailableQuantity);

        // Xác nhận đơn A: giữ chỗ của chính nó không tự chặn → trừ tồn thành công.
        var queueA = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderCode == "HVT-A");
        await logic.ConfirmQueueAsync(queueA.Id, Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(2, stock.QuantityOnHand);
        Assert.Equal(0, stock.ReservedQuantity);
    }

    private static ReplaceCodReservationRequest ReplaceReq(
        Guid orderId, params (Guid SkuId, int Qty)[] lines) =>
        new(
            orderId,
            OperationId: Guid.NewGuid(),
            TotalAmount: lines.Sum(l => l.Qty) * 10_000m,
            Items: lines.Select(l => new ReplaceCodReservationItemRequest(
                l.SkuId, "SKU", "SKU", l.Qty)).ToList());

    /// <summary>
    /// H4 regression — sửa số lượng đơn COD chờ xác nhận: reconcile item tại chỗ (không Clear+re-add),
    /// giữ chỗ điều chỉnh theo delta. Bảo vệ chống lỗi DbUpdateConcurrency{}
    /// (EF UPDATE hàng không tồn tại) từng làm HTTP 500 khi thay giữ chỗ.
    /// </summary>
    [Fact]
    public async Task ReplaceReservation_QuantityIncrease_ReconcilesItemInPlace_AndAdjustsReserved()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 20);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 5));
        var before = await db.StockDeductQueues.Include(q => q.Items).AsNoTracking()
            .FirstAsync(q => q.OrderId == orderId);
        var originalItemId = before.Items.Single().Id;

        var result = await logic.ReplaceCodReservationAsync(ReplaceReq(orderId, (skuId, 8)));

        Assert.True(result.Replaced);
        var queue = await db.StockDeductQueues.Include(q => q.Items).AsNoTracking()
            .FirstAsync(q => q.OrderId == orderId);
        var item = Assert.Single(queue.Items);
        Assert.Equal(originalItemId, item.Id);   // dòng cũ được tái dùng, không tạo mới
        Assert.Equal(8, item.Quantity);
        Assert.True(queue.IsReserved);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(8, stock.ReservedQuantity);  // 5 → 8 theo delta +3
        Assert.Equal(20, stock.QuantityOnHand);
    }

    [Fact]
    public async Task ReplaceReservation_QuantityDecrease_ReleasesDelta()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 20);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 9));
        await logic.ReplaceCodReservationAsync(ReplaceReq(orderId, (skuId, 4)));

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, stock.ReservedQuantity);  // 9 → 4, nhả 5
    }

    [Fact]
    public async Task ReplaceReservation_AddAndRemoveSku_ReconcilesItemsAndReservations()
    {
        await using var db = NewContext();
        var skuA = Guid.NewGuid();
        var skuB = Guid.NewGuid();
        await SeedStockAsync(db, skuA, onHand: 20, code: "SKU-A");
        await SeedStockAsync(db, skuB, onHand: 20, code: "SKU-B");
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        // Đơn ban đầu chỉ có SKU-A x3.
        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuA, 3));

        // Sửa thành SKU-B x6 (bỏ A, thêm B).
        var result = await logic.ReplaceCodReservationAsync(ReplaceReq(orderId, (skuB, 6)));
        Assert.True(result.Replaced);

        var queue = await db.StockDeductQueues.Include(q => q.Items).AsNoTracking()
            .FirstAsync(q => q.OrderId == orderId);
        var item = Assert.Single(queue.Items);
        Assert.Equal(skuB, item.SkuId);
        Assert.Equal(6, item.Quantity);

        var stockA = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuA);
        var stockB = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuB);
        Assert.Equal(0, stockA.ReservedQuantity);  // A đã nhả hết
        Assert.Equal(6, stockB.ReservedQuantity);  // B giữ mới
    }

    [Fact]
    public async Task ReplaceReservation_SameOperationId_IsIdempotent()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 20);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 5));
        var req = ReplaceReq(orderId, (skuId, 8));

        var first = await logic.ReplaceCodReservationAsync(req);
        var second = await logic.ReplaceCodReservationAsync(req); // cùng OperationId → no-op

        Assert.True(first.Replaced);
        Assert.False(second.Replaced);
        Assert.True(second.AlreadyProcessed);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(8, stock.ReservedQuantity); // không nhân đôi delta
    }

    // ── POS-04 Shipping (deduct-later) trong chế độ lô (SimulateWarehouse=false) ──
    // Xác nhận queue trừ đồng thời aggregate QuantityOnHand và WarehouseBatchItem tại
    // Kệ Hàng theo FEFO; tạo slip + allocation + ledger; idempotent khi gọi lại.

    private static async Task SeedShelfBatchAsync(
        InventoryDbContext db, Guid skuId, int qty, string lotCode,
        DateTime? expiresAt = null, string code = "SKU-1")
    {
        var batchId = Guid.NewGuid();
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = batchId,
            LotCode = lotCode,
            Location = "Shelf",
            Status = "active",
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items =
            {
                new WarehouseBatchItem
                {
                    Id = Guid.NewGuid(),
                    WarehouseBatchId = batchId,
                    SkuId = skuId,
                    SkuCode = code,
                    QuantityOnHand = qty,
                    InitialQuantity = qty,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                }
            }
        });
        await db.SaveChangesAsync();
    }

    private static async Task SyncShelfAggregateAsync(InventoryDbContext db, Guid skuId)
    {
        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        stock.QuantityOnHand = await db.WarehouseBatchItems
            .Where(i => i.SkuId == skuId)
            .Join(db.WarehouseBatches.Where(b => b.Status == "active" && b.Location == "Shelf"),
                i => i.WarehouseBatchId, b => b.Id, (i, _) => i.QuantityOnHand)
            .SumAsync();
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Shipping_BatchMode_DeductsAggregateAndBatch_BySameQuantity()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 0);
        await SeedShelfBatchAsync(db, skuId, qty: 10, lotCode: "SHELF-L1");
        await SyncShelfAggregateAsync(db, skuId); // aggregate == tổng lô = 10
        var logic = BuildLogic(db, simulateWarehouse: false);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);

        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        var batchSum = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.SkuId == skuId).SumAsync(i => i.QuantityOnHand);
        Assert.Equal(4, stock.QuantityOnHand);   // aggregate giảm đúng 6
        Assert.Equal(4, batchSum);               // lô giảm đúng 6
        Assert.Equal(stock.QuantityOnHand, batchSum); // aggregate luôn khớp tổng lô
        Assert.Equal(0, stock.ReservedQuantity);
    }

    [Fact]
    public async Task Shipping_BatchMode_CreatesSlip_Allocation_AndLedger()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 0);
        await SeedShelfBatchAsync(db, skuId, qty: 10, lotCode: "SHELF-L1");
        await SyncShelfAggregateAsync(db, skuId);
        var logic = BuildLogic(db, simulateWarehouse: false);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);

        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var slip = await db.StockExportSlips.AsNoTracking().SingleAsync();
        Assert.Equal("sales_deduct_later", slip.ExportType);
        Assert.Equal(orderId, slip.ReferenceId);
        Assert.Equal(6, slip.Quantity);

        var allocations = await db.StockExportBatchAllocations.AsNoTracking().ToListAsync();
        Assert.Single(allocations);
        Assert.Equal(6, allocations[0].Quantity);
        Assert.Equal(slip.Id, allocations[0].StockExportSlipId);

        var ledger = await db.InventoryLedgerEntries.AsNoTracking().ToListAsync();
        var entry = Assert.Single(ledger);
        Assert.Equal("SALES_DEDUCT_LATER", entry.TransactionType);
        Assert.Equal("Shelf", entry.Location);
        Assert.Equal(-6, entry.QuantityDelta);
        Assert.Equal(10, entry.QuantityBefore);
        Assert.Equal(4, entry.QuantityAfter);
    }

    [Fact]
    public async Task Shipping_BatchMode_Duplicate_ProducesNoSecondEffect()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 0);
        await SeedShelfBatchAsync(db, skuId, qty: 10, lotCode: "SHELF-L1");
        await SyncShelfAggregateAsync(db, skuId);
        var logic = BuildLogic(db, simulateWarehouse: false);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);

        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);
        // Xác nhận lần hai: queue đã Confirmed → chặn, không trừ lần nữa.
        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null));

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        var batchSum = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.SkuId == skuId).SumAsync(i => i.QuantityOnHand);
        Assert.Equal(4, stock.QuantityOnHand);   // vẫn chỉ trừ 1 lần
        Assert.Equal(4, batchSum);
        Assert.Single(await db.StockExportSlips.AsNoTracking().ToListAsync());
        Assert.Single(await db.StockExportBatchAllocations.AsNoTracking().ToListAsync());
        Assert.Single(await db.InventoryLedgerEntries.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Shipping_ThenRestock_IncreasesOnlyByReturnedQuantity_NoResyncJump()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 0);
        await SeedShelfBatchAsync(db, skuId, qty: 10, lotCode: "SHELF-L1");
        await SyncShelfAggregateAsync(db, skuId);
        var logic = BuildLogic(db, simulateWarehouse: false);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var afterShip = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, afterShip.QuantityOnHand); // aggregate đã khớp lô = 4

        // Nhập lại 1 vào Kệ Hàng như một lô restock → aggregate phải = 5, không nhảy về 11.
        await SeedShelfBatchAsync(db, skuId, qty: 1, lotCode: "SHELF-RESTOCK-1");
        await SyncShelfAggregateAsync(db, skuId);

        var afterRestock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        var batchSum = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.SkuId == skuId).SumAsync(i => i.QuantityOnHand);
        Assert.Equal(5, afterRestock.QuantityOnHand); // tăng đúng 1, không nhảy do re-sync
        Assert.Equal(5, batchSum);
    }
}
