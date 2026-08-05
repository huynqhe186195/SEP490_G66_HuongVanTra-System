using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Exceptions;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using MSOptions = Microsoft.Extensions.Options.Options;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// Phase J1-J3: return inspection disposition workflow.
/// Tạo return KHÔNG tự tăng tồn bán; phải qua InspectReturn
/// (RestockApproved → tăng Shelf một lần; Quarantined → lô kiểm dịch không sellable;
/// Disposed → không đổi tồn). Idempotent theo (ReturnId, SkuId) và theo inspection đã xử lý.
/// Dùng batch repo thật + SkuStock in-memory (không SimulateWarehouse cho path Shelf-batch).
/// </summary>
public sealed class ReturnInspectionTests
{
    // ── infrastructure ──────────────────────────────────────────────────────

    private static InventoryDbContext NewDb() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"ri-{Guid.NewGuid():N}")
            .Options);

    private sealed class InMemorySkuStockRepo(InventoryDbContext db) : ISkuStockRepository
    {
        public Task<SkuStock?> GetBySkuIdAsync(Guid id, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == id, ct);
        public Task<SkuStock?> GetBySkuIdWithLockAsync(Guid id, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == id, ct);
        public Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default) =>
            db.SkuStocks.OrderBy(s => s.SkuCode).ToListAsync(ct);
        public async Task AddAsync(SkuStock s, CancellationToken ct = default) =>
            await db.SkuStocks.AddAsync(s, ct);
        public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            db.SaveChangesAsync(ct);
    }

    private sealed class PassThrough : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private static InventoryLogic BuildLogic(InventoryDbContext db)
    {
        var opts = MSOptions.Create(new InventoryOptions { SimulateWarehouse = false });
        return new InventoryLogic(
            new InMemorySkuStockRepo(db),
            new StockDeductQueueRepository(db),
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
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
            opts);
    }

    private static async Task<SkuStock> SeedStockAsync(
        InventoryDbContext db, Guid skuId, int shelfOnHand, string code = "SKU-RI")
    {
        var s = new SkuStock
        {
            SkuId = skuId,
            SkuCode = code,
            QuantityOnHand = shelfOnHand,
            WarehouseQuantityOnHand = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.SkuStocks.Add(s);
        await db.SaveChangesAsync();
        return s;
    }

    private static OrderReturnedEvent ReturnEvent(
        Guid returnId, Guid skuId, int qty,
        Guid? eventId = null, decimal refundAmount = 0m, string skuCode = "SKU-RI")
        => new()
        {
            EventId = eventId ?? Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            ReturnId = returnId,
            ReturnCode = $"RET-{returnId:N}"[..12],
            OrderId = Guid.NewGuid(),
            OrderCode = $"HVT-{returnId:N}"[..10],
            ReturnAmount = 100m,
            OrderFinalAmount = 100m,
            RefundAmount = refundAmount,
            Items = [new OrderItemEvent { SkuId = skuId, SkuCode = skuCode, SkuName = "Sản phẩm", Quantity = qty }],
        };

    private static async Task<ReturnInspection> SinglePendingAsync(InventoryDbContext db, Guid returnId) =>
        await db.ReturnInspections.AsNoTracking().SingleAsync(r => r.ReturnId == returnId);

    private static async Task SeedShelfBatchAsync(
        InventoryDbContext db, Guid skuId, int qty, string lotCode, string code = "SKU-RI")
    {
        var batchId = Guid.NewGuid();
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = batchId,
            LotCode = lotCode,
            Location = "Shelf",
            Status = "active",
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

    private static OrderPlacedEvent CodPlaced(Guid orderId, Guid skuId, int qty, string code = "SKU-RI") =>
        new()
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = $"HVT-{orderId:N}"[..10],
            OrderStatus = "PendingPayment",
            OrderChannel = "COD",
            TotalAmount = 10_000m,
            Items = [new OrderItemEvent { SkuId = skuId, SkuCode = code, SkuName = "Sản phẩm", Quantity = qty }],
        };

    // ── POS-04 + J: Shipping (deduct-later) rồi Return RestockApproved ────────
    // Sau khi ship trừ lô Kệ Hàng, aggregate == tổng lô. Return 1 + RestockApproved
    // chỉ tăng đúng 1, không nhảy tồn do đồng bộ lại aggregate từ lô.

    [Fact]
    public async Task ShippingThenRestockApproved_IncreasesOnlyByReturnedQuantity()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0);
        await SeedShelfBatchAsync(db, sku, qty: 10, lotCode: "SHELF-E2E");
        await SyncShelfAggregateAsync(db, sku);
        var logic = BuildLogic(db);
        var actor = Guid.NewGuid();

        // 1) COD ship: trừ 4 khỏi lô Kệ Hàng → aggregate = 6, khớp tổng lô.
        var orderId = Guid.NewGuid();
        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, sku, 4));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        await logic.ConfirmQueueAsync(queue.Id, actor, null);

        var afterShip = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        var batchAfterShip = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.SkuId == sku).SumAsync(i => i.QuantityOnHand);
        Assert.Equal(6, afterShip.QuantityOnHand);
        Assert.Equal(6, batchAfterShip);

        // 2) Return 1 + RestockApproved → tồn tăng đúng 1 (6 → 7), không nhảy.
        var returnId = Guid.NewGuid();
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 1, skuCode: "SKU-RI"));
        var insp = await SinglePendingAsync(db, returnId);
        await logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("RestockApproved", "OK bán lại"), actor);

        var afterRestock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        var batchAfterRestock = await db.WarehouseBatchItems.AsNoTracking()
            .Where(i => i.SkuId == sku).SumAsync(i => i.QuantityOnHand);
        Assert.Equal(7, afterRestock.QuantityOnHand); // tăng đúng 1
        Assert.Equal(7, batchAfterRestock);
    }

    // ── J2: creating a return must NOT auto-increase sellable stock ───────────

    [Fact]
    public async Task OrderReturned_DoesNotIncreaseShelf_CreatesPendingInspection()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 3);
        var returnId = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2));

        // Sellable shelf stock untouched.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(3, stock.QuantityOnHand);

        // Pending inspection created.
        var insp = await SinglePendingAsync(db, returnId);
        Assert.Equal("Pending", insp.Disposition.ToString());
        Assert.Equal(2, insp.Quantity);
        Assert.Null(insp.InspectedBy);
        Assert.Null(insp.InspectedAt);

        // No warehouse batch of any kind was created by the return itself.
        Assert.Empty(await db.WarehouseBatches.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task OrderReturned_WithRefund_StillNoAutoRestock()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 5);
        var returnId = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 4, refundAmount: 50m));

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(5, stock.QuantityOnHand); // refund does not restock

        var insp = await SinglePendingAsync(db, returnId);
        Assert.Equal("Pending", insp.Disposition.ToString());
    }

    // ── J3: RestockApproved increases Shelf exactly once ─────────────────────

    [Fact]
    public async Task RestockApproved_IncreasesShelf_ExactlyOnce()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0); // batch-authoritative shelf
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 6));
        var insp = await SinglePendingAsync(db, returnId);

        var result = await logic.InspectReturnAsync(
            insp.Id, new InspectReturnRequest("RestockApproved", "OK để bán lại"), inspector);

        Assert.Equal("RestockApproved", result.Disposition);
        Assert.NotNull(result.RestockBatchId);
        Assert.Equal(inspector, result.InspectedBy);
        Assert.NotNull(result.InspectedAt);

        // Shelf synced from batches = the single restock batch of 6.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(6, stock.QuantityOnHand);

        // Exactly one shelf batch created.
        var shelfBatches = await db.WarehouseBatches.AsNoTracking().Where(b => b.Location == "Shelf").ToListAsync();
        Assert.Single(shelfBatches);
    }

    [Fact]
    public async Task RestockApproved_Duplicate_DoesNotIncreaseTwice()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0);
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 6));
        var insp = await SinglePendingAsync(db, returnId);

        var first = await logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("RestockApproved", null), inspector);
        var second = await logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("RestockApproved", null), inspector);

        // Idempotent: same batch id both times, no second batch.
        Assert.Equal(first.RestockBatchId, second.RestockBatchId);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(6, stock.QuantityOnHand); // still 6, not 12

        var shelfBatches = await db.WarehouseBatches.AsNoTracking().Where(b => b.Location == "Shelf").ToListAsync();
        Assert.Single(shelfBatches);
    }

    // ── J3: Quarantined does not increase sellable stock ─────────────────────

    [Fact]
    public async Task Quarantined_DoesNotIncreaseSellableStock_CreatesQuarantineBatch()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 7);
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 3));
        var insp = await SinglePendingAsync(db, returnId);

        var result = await logic.InspectReturnAsync(
            insp.Id, new InspectReturnRequest("Quarantined", "Nghi ngờ hư"), inspector);

        Assert.Equal("Quarantined", result.Disposition);
        Assert.NotNull(result.QuarantineBatchId);
        Assert.Null(result.RestockBatchId);

        // Sellable shelf unchanged.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(7, stock.QuantityOnHand);

        // Quarantine batch exists but is NOT Shelf/Warehouse.
        var qBatch = await db.WarehouseBatches.AsNoTracking().SingleAsync(b => b.Id == result.QuarantineBatchId);
        Assert.Equal("Quarantine", qBatch.Location);
        Assert.Empty(await db.WarehouseBatches.AsNoTracking().Where(b => b.Location == "Shelf").ToListAsync());
    }

    // ── J3: Disposed does not increase sellable stock ────────────────────────

    [Fact]
    public async Task Disposed_DoesNotIncreaseSellableStock_NoBatch()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 4);
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2));
        var insp = await SinglePendingAsync(db, returnId);

        var result = await logic.InspectReturnAsync(
            insp.Id, new InspectReturnRequest("Disposed", "Hỏng, tiêu hủy"), inspector);

        Assert.Equal("Disposed", result.Disposition);
        Assert.Null(result.RestockBatchId);
        Assert.Null(result.QuarantineBatchId);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(4, stock.QuantityOnHand);
        Assert.Empty(await db.WarehouseBatches.AsNoTracking().ToListAsync());
    }

    // ── J3: conflicting decision after a final disposition is rejected ───────
    // First-wins idempotency: a second, different disposition never overwrites.

    [Fact]
    public async Task ConflictingDecision_AfterFinalDisposition_IsIgnored()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0);
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 5));
        var insp = await SinglePendingAsync(db, returnId);

        await logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("RestockApproved", null), inspector);
        // Attempt to override with Disposed → must keep the original decision.
        var conflict = await logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("Disposed", null), Guid.NewGuid());

        Assert.Equal("RestockApproved", conflict.Disposition);
        Assert.NotNull(conflict.RestockBatchId);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(5, stock.QuantityOnHand); // unchanged by the conflicting call
    }

    [Fact]
    public async Task InvalidDisposition_Throws_NoStateChange()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0);
        var returnId = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 5));
        var insp = await SinglePendingAsync(db, returnId);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("Nonsense", null), Guid.NewGuid()));
        // "Pending" is not an acceptable manual decision.
        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.InspectReturnAsync(insp.Id, new InspectReturnRequest("Pending", null), Guid.NewGuid()));

        var reloaded = await SinglePendingAsync(db, returnId);
        Assert.Equal("Pending", reloaded.Disposition.ToString());
        Assert.Empty(await db.WarehouseBatches.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task InspectUnknownInspection_Throws()
    {
        await using var db = NewDb();
        var logic = BuildLogic(db);
        await Assert.ThrowsAsync<InventoryNotFoundException>(() =>
            logic.InspectReturnAsync(Guid.NewGuid(), new InspectReturnRequest("Disposed", null), Guid.NewGuid()));
    }

    // ── J1/G6: duplicate return event creates no duplicate effect ────────────

    [Fact]
    public async Task DuplicateReturnEvent_SameEventId_CreatesInspectionOnce()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 3);
        var returnId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2, eventId: eventId));
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2, eventId: eventId));

        var inspections = await db.ReturnInspections.AsNoTracking().Where(r => r.ReturnId == returnId).ToListAsync();
        Assert.Single(inspections);
    }

    [Fact]
    public async Task DuplicateReturnEvent_DifferentEventId_SameReturn_CreatesInspectionOnce()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 3);
        var returnId = Guid.NewGuid();

        var logic = BuildLogic(db);
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2, eventId: Guid.NewGuid()));
        // Different EventId but same ReturnId → business-key guard blocks reprocessing.
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 2, eventId: Guid.NewGuid()));

        var inspections = await db.ReturnInspections.AsNoTracking().Where(r => r.ReturnId == returnId).ToListAsync();
        Assert.Single(inspections);
    }

    // ── J: refund state and inventory disposition are separately auditable ───

    [Fact]
    public async Task RefundAndDisposition_AreIndependentlyTraceable()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedStockAsync(db, sku, shelfOnHand: 0);
        var returnId = Guid.NewGuid();
        var inspector = Guid.NewGuid();

        var logic = BuildLogic(db);
        // Return carries a refund; inventory never stores/needs the refund amount.
        await logic.HandleOrderReturnedAsync(ReturnEvent(returnId, sku, 5, refundAmount: 75m));
        var insp = await SinglePendingAsync(db, returnId);

        // Disposition decided independently of any refund settlement.
        var result = await logic.InspectReturnAsync(
            insp.Id, new InspectReturnRequest("Disposed", "Không đạt kiểm tra"), inspector);

        Assert.Equal("Disposed", result.Disposition);
        Assert.Equal(inspector, result.InspectedBy);
        Assert.NotNull(result.InspectedAt);
        // Inventory disposition = Disposed even though the customer was refunded:
        // the two states live in separate records and never coupled here.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(0, stock.QuantityOnHand);
    }
}
