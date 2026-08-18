using System.Text.Json;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using MSOptions = Microsoft.Extensions.Options.Options;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// Phase I4-I7: BOM reconciliation queue confirmation workflow.
/// I4 — successful BOM confirm deducts WarehouseQuantityOnHand;
/// I5 — insufficient warehouse materials → Insufficient status, no deduction;
/// I6 — retry after restock succeeds;
/// I7 — cancel queue releases cleanly.
/// SimulateWarehouse=true + InMemory.
/// </summary>
public sealed class BomReconciliationTests
{
    // ── serializer (must match InventoryLogic.MaterialSnapshotJsonOptions) ──
    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    // ── infrastructure ──────────────────────────────────────────────────────

    private static InventoryDbContext NewDb() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"bom-{Guid.NewGuid():N}")
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

    private sealed class FakeCatalogClient : IProductCatalogClient
    {
        private static ProductCatalogSnapshot ForIds(IEnumerable<Guid> ids)
        {
            var products = ids.ToList().Select(id =>
            {
                var pid = Guid.NewGuid();
                return new CatalogProduct(pid, "Test", "THANH_PHAM", "Piece", "Cái", true,
                    [new CatalogVariant(id, pid, "SKU", "Test", true, true, false, 0, [], CanHaveBom: true)]);
            }).ToList();
            return new ProductCatalogSnapshot(products);
        }

        public Task<ProductCatalogSnapshot> GetCatalogAsync(CancellationToken ct = default) =>
            Task.FromResult(new ProductCatalogSnapshot([]));

        public Task<ProductCatalogSnapshot> GetCatalogForVariantIdsAsync(
            IEnumerable<Guid> variantIds, CancellationToken ct = default) =>
            Task.FromResult(ForIds(variantIds));

        public Task<ProductCatalogSnapshot> GetSupplierReceiptCatalogForVariantIdsAsync(
            IEnumerable<Guid> variantIds, CancellationToken ct = default) =>
            Task.FromResult(new ProductCatalogSnapshot([]));
    }

    private static InventoryLogic BuildLogic(InventoryDbContext db)
    {
        var opts = MSOptions.Create(new InventoryOptions { SimulateWarehouse = true });
        return new InventoryLogic(
            new InMemorySkuStockRepo(db),
            new StockDeductQueueRepository(db),
            Mock.Of<IStockAdjustmentRequestRepository>(),
            Mock.Of<IStockExportSlipRepository>(),
            Mock.Of<IStockImportSlipRepository>(),
            Mock.Of<IWarehouseBatchRepository>(),
            Mock.Of<IStockExportBatchAllocationRepository>(),
            Mock.Of<IInventoryLedgerRepository>(),
            Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            new FakeCatalogClient(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
            Mock.Of<HuongVanTra.Shared.Notifications.INotificationClient>(),
            opts);
    }

    /// <summary>Seeds a BOM reconciliation queue with a single material snapshot.</summary>
    private static async Task<(StockDeductQueue queue, SkuStock materialStock)> SeedBomQueueAsync(
        InventoryDbContext db,
        Guid materialSkuId,
        int requiredQty,
        int warehouseQty,
        QueueStatus status = QueueStatus.Waiting)
    {
        var snapshot = new[]
        {
            new
            {
                materialProductId = Guid.NewGuid(),
                materialSkuId,
                materialSkuCode = "MAT-BOM",
                materialName = "Nguyên liệu BOM",
                unitName = "gram",
                requiredQuantity = requiredQty,
                availableAtCheckout = warehouseQty,
                reservedByOtherPendingAtCheckout = 0,
            }
        };

        var queue = new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = Guid.NewGuid(),
            OrderCode = "HVT-BOM-001",
            OrderPaymentStatus = "completed",
            OrderStockStatus = "pending_bom_reconciliation",
            QueueStatus = status,
            TotalAmount = 100m,
            IsDeducted = false,
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    SkuId = Guid.NewGuid(),
                    SkuSnapshotName = "Thành phẩm",
                    SkuSnapshotCode = "FINISH-BOM",
                    Quantity = requiredQty,
                    OrderedQuantity = requiredQty,
                    FinishedDeductedQuantity = 0,
                    PendingBomQuantity = requiredQty,
                    StockHandlingMode = "FullBomPending",
                    MaterialRequirementSnapshotJson = JsonSerializer.Serialize(snapshot, WebJson),
                }
            ]
        };

        var materialStock = new SkuStock
        {
            SkuId = materialSkuId,
            SkuCode = "MAT-BOM",
            QuantityOnHand = 0,
            WarehouseQuantityOnHand = warehouseQty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Set<StockDeductQueue>().Add(queue);
        db.SkuStocks.Add(materialStock);
        await db.SaveChangesAsync();
        return (queue, materialStock);
    }

    // ── I4: successful BOM confirmation ──────────────────────────────────────

    [Fact]
    public async Task ConfirmBomQueue_SufficientWarehouse_DeductsAndConfirms()
    {
        await using var db = NewDb();
        var materialSku = Guid.NewGuid();
        var (queue, _) = await SeedBomQueueAsync(db, materialSku, requiredQty: 6, warehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        Assert.Equal("confirmed", result.QueueStatus);
        Assert.True(result.CanDeduct);
        Assert.NotNull(result.ConfirmedAt);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == materialSku);
        Assert.Equal(4, stock.WarehouseQuantityOnHand); // 10 - 6
    }

    // ── I5: insufficient materials → Insufficient, no deduction ──────────────

    [Fact]
    public async Task ConfirmBomQueue_InsufficientWarehouse_MarksInsufficient_NoDeduction()
    {
        await using var db = NewDb();
        var materialSku = Guid.NewGuid();
        var (queue, _) = await SeedBomQueueAsync(db, materialSku, requiredQty: 8, warehouseQty: 3);

        var logic = BuildLogic(db);
        var result = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        Assert.Equal("insufficient", result.QueueStatus);
        Assert.False(result.CanDeduct);
        Assert.NotEmpty(result.Shortages ?? []);

        // Warehouse stock must NOT have been mutated
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == materialSku);
        Assert.Equal(3, stock.WarehouseQuantityOnHand);
    }

    // ── I6: retry after restock ───────────────────────────────────────────────

    [Fact]
    public async Task ConfirmBomQueue_RetryAfterRestock_Succeeds()
    {
        await using var db = NewDb();
        var materialSku = Guid.NewGuid();
        // First seed: insufficient
        var (queue, materialStock) = await SeedBomQueueAsync(
            db, materialSku, requiredQty: 5, warehouseQty: 2, status: QueueStatus.Insufficient);

        var logic = BuildLogic(db);

        // First attempt fails
        var attempt1 = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);
        Assert.Equal("insufficient", attempt1.QueueStatus);

        // Restock: set warehouse to 10
        materialStock.WarehouseQuantityOnHand = 10;
        materialStock.UpdatedAt = DateTime.UtcNow;
        db.SkuStocks.Update(materialStock);
        await db.SaveChangesAsync();

        // Second attempt should succeed
        var attempt2 = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);
        Assert.Equal("confirmed", attempt2.QueueStatus);
        Assert.True(attempt2.CanDeduct);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == materialSku);
        Assert.Equal(5, stock.WarehouseQuantityOnHand); // 10 - 5
    }

    // ── I7: cancel BOM queue ─────────────────────────────────────────────────

    [Fact]
    public async Task CancelBomQueue_WithReason_CancelsCleanly()
    {
        await using var db = NewDb();
        var materialSku = Guid.NewGuid();
        var (queue, _) = await SeedBomQueueAsync(db, materialSku, requiredQty: 4, warehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.CancelQueueAsync(
            queue.Id,
            new CancelStockDeductRequest("Khách hủy đơn"),
            Guid.NewGuid(),
            null);

        Assert.Equal("cancelled", result.QueueStatus);
        Assert.Equal("Khách hủy đơn", result.CancelReason);

        // Warehouse must be untouched
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == materialSku);
        Assert.Equal(10, stock.WarehouseQuantityOnHand);
    }

    [Fact]
    public async Task CancelBomQueue_WithoutReason_Throws()
    {
        await using var db = NewDb();
        var materialSku = Guid.NewGuid();
        var (queue, _) = await SeedBomQueueAsync(db, materialSku, requiredQty: 3, warehouseQty: 10);

        var logic = BuildLogic(db);
        await Assert.ThrowsAsync<InventoryService.Domain.Exceptions.InventoryValidationException>(() =>
            logic.CancelQueueAsync(queue.Id, new CancelStockDeductRequest(null), Guid.NewGuid(), null));
    }

    // ── POS-06 (KB2/KB3): queue chờ điều chuyển Kho → Kệ ─────────────────────

    /// <summary>
    /// Seeds a queue mixing a warehouse-transfer portion (KB2) with an optional BOM portion (KB3).
    /// </summary>
    private static async Task<(StockDeductQueue queue, SkuStock finishedStock)> SeedTransferQueueAsync(
        InventoryDbContext db,
        Guid finishedSkuId,
        int transferQty,
        int finishedWarehouseQty,
        Guid? materialSkuId = null,
        int bomQty = 0,
        int materialWarehouseQty = 0)
    {
        string? snapshotJson = null;
        if (materialSkuId.HasValue && bomQty > 0)
        {
            snapshotJson = JsonSerializer.Serialize(
                new[]
                {
                    new
                    {
                        materialProductId = Guid.NewGuid(),
                        materialSkuId = materialSkuId.Value,
                        materialSkuCode = "MAT-TRANSFER",
                        materialName = "Nguyên liệu điều chuyển",
                        unitName = "gram",
                        requiredQuantity = bomQty,
                        availableAtCheckout = materialWarehouseQty,
                        reservedByOtherPendingAtCheckout = 0,
                    }
                },
                WebJson);

            db.SkuStocks.Add(new SkuStock
            {
                SkuId = materialSkuId.Value,
                SkuCode = "MAT-TRANSFER",
                QuantityOnHand = 0,
                WarehouseQuantityOnHand = materialWarehouseQty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        var queue = new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = Guid.NewGuid(),
            OrderCode = "HVT-TRANSFER-001",
            OrderPaymentStatus = "completed",
            OrderStockStatus = bomQty > 0 ? "pending_bom_reconciliation" : "pending_warehouse_transfer",
            QueueStatus = QueueStatus.Waiting,
            TotalAmount = 100m,
            IsDeducted = false,
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    SkuId = finishedSkuId,
                    SkuSnapshotName = "Thành phẩm điều chuyển",
                    SkuSnapshotCode = "FINISH-TRANSFER",
                    Quantity = transferQty + bomQty,
                    OrderedQuantity = transferQty + bomQty,
                    FinishedDeductedQuantity = 0,
                    PendingBomQuantity = bomQty,
                    WarehouseTransferQuantity = transferQty,
                    StockHandlingMode = bomQty > 0 ? "PartialFinishedDeductedBomPending" : "WarehouseTransferPending",
                    MaterialRequirementSnapshotJson = snapshotJson,
                }
            ]
        };

        var finishedStock = new SkuStock
        {
            SkuId = finishedSkuId,
            SkuCode = "FINISH-TRANSFER",
            QuantityOnHand = 0,
            WarehouseQuantityOnHand = finishedWarehouseQty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Set<StockDeductQueue>().Add(queue);
        db.SkuStocks.Add(finishedStock);
        await db.SaveChangesAsync();
        return (queue, finishedStock);
    }

    [Fact]
    public async Task ConfirmTransferQueue_SufficientWarehouse_MovesStockAndConfirms()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var (queue, _) = await SeedTransferQueueAsync(
            db, finishedSku, transferQty: 4, finishedWarehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        Assert.Equal("confirmed", result.QueueStatus);
        Assert.True(result.CanDeduct);

        // Kho giảm 4, phần về Kệ được xuất bán ngay nên tồn Kệ trở lại 0.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(6, stock.WarehouseQuantityOnHand);
        Assert.Equal(0, stock.QuantityOnHand);
    }

    [Fact]
    public async Task ConfirmTransferQueue_InsufficientWarehouse_MarksInsufficient_NoMovement()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var (queue, _) = await SeedTransferQueueAsync(
            db, finishedSku, transferQty: 7, finishedWarehouseQty: 3);

        var logic = BuildLogic(db);
        var result = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        Assert.Equal("insufficient", result.QueueStatus);
        Assert.False(result.CanDeduct);
        Assert.NotEmpty(result.Shortages ?? []);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(3, stock.WarehouseQuantityOnHand);
        Assert.Equal(0, stock.QuantityOnHand);
    }

    [Fact]
    public async Task ConfirmMixedTransferAndBomQueue_ProducesAndTransfers()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        var (queue, _) = await SeedTransferQueueAsync(
            db, finishedSku, transferQty: 2, finishedWarehouseQty: 5,
            materialSkuId: materialSku, bomQty: 3, materialWarehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        Assert.Equal("confirmed", result.QueueStatus);
        Assert.True(result.CanDeduct);

        // Nguyên liệu bị trừ theo BOM.
        var material = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == materialSku);
        Assert.Equal(7, material.WarehouseQuantityOnHand);

        // Kho thành phẩm: 5 + 3 sản xuất - 5 điều chuyển = 3; phần về Kệ đã xuất bán hết.
        var finished = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(3, finished.WarehouseQuantityOnHand);
        Assert.Equal(0, finished.QuantityOnHand);
    }

    [Fact]
    public async Task CancelTransferQueue_LeavesWarehouseUntouched()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var (queue, _) = await SeedTransferQueueAsync(
            db, finishedSku, transferQty: 4, finishedWarehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.CancelQueueAsync(
            queue.Id, new CancelStockDeductRequest("Khách đổi ý"), Guid.NewGuid(), null);

        Assert.Equal("cancelled", result.QueueStatus);

        // KB2: chưa trừ Kho lúc checkout nên hủy không hoàn gì, tồn giữ nguyên.
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(10, stock.WarehouseQuantityOnHand);
        Assert.Equal(0, stock.QuantityOnHand);
    }
}
