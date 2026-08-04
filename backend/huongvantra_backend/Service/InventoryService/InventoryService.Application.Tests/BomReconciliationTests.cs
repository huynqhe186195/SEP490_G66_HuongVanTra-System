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
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
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
}
