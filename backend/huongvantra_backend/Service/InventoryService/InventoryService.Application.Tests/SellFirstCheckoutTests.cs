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
/// Phase I1-I3: sell-first checkout.
/// I2 — tồn khả bán đúng (trừ COD Reserved);
/// I3 — trừ ngay Shelf, tạo BOM queue phần thiếu, block khi tổng nguồn không đủ, idempotency.
/// SimulateWarehouse=true + InMemory để tránh Docker/batch repo.
/// </summary>
public sealed class SellFirstCheckoutTests
{
    // ── infrastructure ──────────────────────────────────────────────────────

    private static InventoryDbContext NewDb() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"sf-{Guid.NewGuid():N}")
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

    private static InventoryLogic BuildLogic(
        InventoryDbContext db,
        IProductCatalogClient? catalogClient = null,
        bool simulateWarehouse = true)
    {
        var opts = MSOptions.Create(new InventoryOptions { SimulateWarehouse = simulateWarehouse });
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
            Mock.Of<IShelfReturnRequestRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            catalogClient ?? Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
            opts);
    }

    /// <param name="warehouseQty">WarehouseQuantityOnHand — used by SimulateWarehouse BOM checks for raw materials.</param>
    private static async Task<SkuStock> SeedAsync(
        InventoryDbContext db,
        Guid skuId,
        int onHand,
        int reserved = 0,
        string code = "SKU-A",
        int warehouseQty = 0)
    {
        var s = new SkuStock
        {
            SkuId = skuId,
            SkuCode = code,
            QuantityOnHand = onHand,
            WarehouseQuantityOnHand = warehouseQty,
            ReservedQuantity = reserved,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.SkuStocks.Add(s);
        await db.SaveChangesAsync();
        return s;
    }

    private static PreparePosStockDeductionRequest Req(Guid orderId, params (Guid skuId, int qty)[] lines) =>
        new(
            orderId,
            $"HVT-{orderId:N}"[..10],
            "completed",
            100m,
            lines.Select(l => new PreparePosStockDeductionItemRequest(l.skuId, "P", "C", l.qty)).ToList());

    // ── I3: pure-shelf sufficient — no BOM path entered ────────────────────

    [Fact]
    public async Task ShelfSufficient_DeductsImmediately_NoQueue()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 10);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (sku, 4)), Guid.NewGuid(), null);

        Assert.Equal("ImmediateFinishedStockOnly", result.StockHandlingMode);
        Assert.False(result.HasPendingStockReconciliation);
        Assert.Empty(result.QueueIds);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(6, stock.QuantityOnHand);
    }

    // ── I2: reserved reduces available; missing BOM material → blocks ───────
    // onHand=5, reserved=4 → available=1; order 2 → immediate=1, BOM-pending=1.
    // WarehouseQuantityOnHand=0 → material BOM check fails → InsufficientStockException.
    [Fact]
    public async Task ReservedShelf_ReducesAvailable_BlocksOtherCheckout()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 5, reserved: 4, code: "FINISH-R");
        // materialSku WarehouseQuantityOnHand=0 → BOM check finds shortage
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-R", warehouseQty: 0);

        var catalog = BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        var logic = BuildLogic(db, catalogClient.Object);
        // available=1, order 2 → BOM for 1 unit, warehouse material=0 → shortage → exception
        var ex = await Assert.ThrowsAsync<InsufficientStockException>(() =>
            logic.PreparePosStockDeductionAsync(Req(Guid.NewGuid(), (finishedSku, 2)), Guid.NewGuid(), null));
        Assert.NotEmpty(ex.Message);

        // Shelf stock must NOT have been mutated (all-or-nothing)
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(5, stock.QuantityOnHand);
    }

    [Fact]
    public async Task ReservedShelf_ButOrderedExact_Allowed()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 5, reserved: 4);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (sku, 1)), Guid.NewGuid(), null);

        Assert.Equal("ImmediateFinishedStockOnly", result.StockHandlingMode);
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(4, stock.QuantityOnHand);
    }

    // ── I3: partial shelf + BOM queue ────────────────────────────────────────

    [Fact]
    public async Task PartialShelf_WithSufficientBom_CreatesQueue_DeductsPartialImmediately()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 3, code: "FINISH-A");
        // SimulateWarehouse reads WarehouseQuantityOnHand for BOM materials
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-A", warehouseQty: 20);

        var catalog = BuildCatalogWithBom(finishedSku, materialSku, bomQty: 2m);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        var logic = BuildLogic(db, catalogClient.Object);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (finishedSku, 5)), Guid.NewGuid(), null);

        // 3 deducted immediately from shelf, 2 queued for BOM
        Assert.Equal("PartialOrFullPendingBomReconciliation", result.StockHandlingMode);
        Assert.True(result.HasPendingStockReconciliation);
        Assert.Single(result.QueueIds);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(0, stock.QuantityOnHand);

        var line = Assert.Single(result.Lines);
        Assert.Equal(3, line.FinishedDeductedQuantity);
        Assert.Equal(2, line.PendingBomQuantity);
    }

    [Fact]
    public async Task TotalSourceInsufficient_BlocksCheckout_NoPartialEffects()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        // shelf=1; order 3 → immediate=1, BOM-pending=2; BOM needs 2*2=4 warehouse material; warehouse=2 → insufficient
        await SeedAsync(db, finishedSku, onHand: 1, code: "FINISH-B");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-B", warehouseQty: 2);

        var catalog = BuildCatalogWithBom(finishedSku, materialSku, bomQty: 2m);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        var logic = BuildLogic(db, catalogClient.Object);

        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            logic.PreparePosStockDeductionAsync(Req(Guid.NewGuid(), (finishedSku, 3)), Guid.NewGuid(), null));

        // Stock must NOT have been mutated
        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(1, stock.QuantityOnHand);

        var queues = await db.Set<StockDeductQueue>().AsNoTracking().ToListAsync();
        Assert.Empty(queues);
    }

    // Idempotency guard operates on the queue record — only applies when a BOM queue is created.
    [Fact]
    public async Task DuplicateRequest_SameOrderId_BomPath_ReturnsExistingQueue_NoNewDeduction()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        // shelf=0 → all 2 units go to BOM queue; warehouse=10 → sufficient
        await SeedAsync(db, finishedSku, onHand: 0, code: "FINISH-D");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-D", warehouseQty: 10);

        var catalog = BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        var orderId = Guid.NewGuid();
        var logic = BuildLogic(db, catalogClient.Object);

        var first = await logic.PreparePosStockDeductionAsync(
            Req(orderId, (finishedSku, 2)), Guid.NewGuid(), null);
        Assert.Equal("PartialOrFullPendingBomReconciliation", first.StockHandlingMode);
        Assert.Single(first.QueueIds);

        var second = await logic.PreparePosStockDeductionAsync(
            Req(orderId, (finishedSku, 2)), Guid.NewGuid(), null);
        Assert.Equal("ExistingPendingReconciliation", second.StockHandlingMode);

        // Shelf stock not changed (was 0), queue count stays at 1
        var queues = await db.Set<StockDeductQueue>().AsNoTracking().ToListAsync();
        Assert.Single(queues);
    }

    [Fact]
    public async Task MultiItem_AllShelfSufficient_AllDeductedImmediately()
    {
        await using var db = NewDb();
        var sku1 = Guid.NewGuid();
        var sku2 = Guid.NewGuid();
        await SeedAsync(db, sku1, onHand: 10, code: "SKU-1");
        await SeedAsync(db, sku2, onHand: 8, code: "SKU-2");

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (sku1, 3), (sku2, 5)), Guid.NewGuid(), null);

        Assert.Equal("ImmediateFinishedStockOnly", result.StockHandlingMode);
        var s1 = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku1);
        var s2 = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku2);
        Assert.Equal(7, s1.QuantityOnHand);
        Assert.Equal(3, s2.QuantityOnHand);
    }

    [Fact]
    public async Task ZeroShelf_WithSufficientBom_CreatesFullBomQueue()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 0, code: "FINISH-C");
        // Need 3*1=3 warehouse material; WarehouseQuantityOnHand=10 → sufficient
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-C", warehouseQty: 10);

        var catalog = BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        var logic = BuildLogic(db, catalogClient.Object);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (finishedSku, 3)), Guid.NewGuid(), null);

        Assert.Equal("PartialOrFullPendingBomReconciliation", result.StockHandlingMode);
        var line = Assert.Single(result.Lines);
        Assert.Equal(0, line.FinishedDeductedQuantity);
        Assert.Equal(3, line.PendingBomQuantity);
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private static ProductCatalogSnapshot BuildCatalogWithBom(
        Guid finishedSku, Guid materialSku, decimal bomQty)
    {
        var materialVariant = new CatalogVariant(
            materialSku, Guid.NewGuid(), "MAT-CODE", "Nguyên liệu",
            IsActive: true, IsSellable: false, HasBom: false, BomLineCount: 0, BomLines: []);
        var materialProduct = new CatalogProduct(
            Guid.NewGuid(), "Nguyên liệu", "material", "gram", "gram",
            IsActive: true, Variants: [materialVariant]);

        var bomLine = new CatalogBomLine(
            materialProduct.Id, "Nguyên liệu", "gram", bomQty,
            ComponentVariantId: materialSku, ComponentSkuCode: "MAT-CODE",
            ComponentVariantName: "Nguyên liệu", IsRequiredBaseComponent: true);

        var finishedVariant = new CatalogVariant(
            finishedSku, Guid.NewGuid(), "FINISH-CODE", "Thành phẩm",
            IsActive: true, IsSellable: true, HasBom: true, BomLineCount: 1, BomLines: [bomLine]);
        var finishedProduct = new CatalogProduct(
            Guid.NewGuid(), "Thành phẩm", "finished", "cái", "cái",
            IsActive: true, Variants: [finishedVariant]);

        return new ProductCatalogSnapshot([finishedProduct, materialProduct]);
    }
}
