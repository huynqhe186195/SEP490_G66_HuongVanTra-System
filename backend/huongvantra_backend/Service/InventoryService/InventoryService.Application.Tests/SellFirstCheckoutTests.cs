using HuongVanTra.Shared.Messages;
using HuongVanTra.Shared.Notifications;
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
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            catalogClient ?? Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
            Mock.Of<INotificationClient>(),
            opts);
    }

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
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (finishedSku, 2)), Guid.NewGuid(), null);
        Assert.True(result.BackorderRequired);
        Assert.Empty(result.QueueIds);

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

        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (finishedSku, 3)), Guid.NewGuid(), null);
        Assert.True(result.BackorderRequired);
        Assert.Empty(result.QueueIds);

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

    [Fact]
    public async Task ZeroShelf_SufficientWarehouse_QueuesWarehouseTransfer()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 0, code: "FINISH-WH", warehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (sku, 5)), Guid.NewGuid(), null);

        var line = Assert.Single(result.Lines);
        Assert.Equal("WarehouseTransferPending", result.StockHandlingMode);
        Assert.Single(result.QueueIds);
        Assert.Equal(0, line.FinishedDeductedQuantity);
        Assert.Equal(5, line.WarehouseDeductedQuantity);
        Assert.Equal(0, line.PendingBomQuantity);
        // POS-06 (KB2): Kho chưa bị trừ ở checkout, chờ Thủ kho xác nhận điều chuyển.
        var stock = await db.SkuStocks.AsNoTracking().SingleAsync(item => item.SkuId == sku);
        Assert.Equal(0, stock.QuantityOnHand);
        Assert.Equal(10, stock.WarehouseQuantityOnHand);
        var queueItem = await db.StockDeductQueueItems.AsNoTracking().SingleAsync(i => i.SkuId == sku);
        Assert.Equal(5, queueItem.WarehouseTransferQuantity);
    }

    [Fact]
    public async Task PartialShelf_PartialWarehouse_DeductsShelfAndQueuesTransfer()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 3, code: "FINISH-MIX", warehouseQty: 5);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (sku, 7)), Guid.NewGuid(), null);

        var line = Assert.Single(result.Lines);
        Assert.Equal("WarehouseTransferPending", result.StockHandlingMode);
        Assert.Equal(3, line.FinishedDeductedQuantity);
        Assert.Equal(4, line.WarehouseDeductedQuantity);
        Assert.Equal(0, line.PendingBomQuantity);
        Assert.Single(result.QueueIds);
        var stock = await db.SkuStocks.AsNoTracking().SingleAsync(item => item.SkuId == sku);
        Assert.Equal(0, stock.QuantityOnHand);
        Assert.Equal(5, stock.WarehouseQuantityOnHand);
    }

    [Fact]
    public async Task ShelfAndWarehouseInsufficient_RemainingQuantityUsesBomQueue()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 2, code: "FINISH-THREE-TIER", warehouseQty: 3);
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-THREE-TIER", warehouseQty: 10);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (finishedSku, 7)), Guid.NewGuid(), null);

        var line = Assert.Single(result.Lines);
        Assert.Equal("PartialOrFullPendingBomReconciliation", result.StockHandlingMode);
        Assert.Equal(2, line.FinishedDeductedQuantity);
        Assert.Equal(3, line.WarehouseDeductedQuantity);
        Assert.Equal(2, line.PendingBomQuantity);
        Assert.Single(result.QueueIds);
    }

    [Fact]
    public async Task MultipleSkus_UseWarehouseIndependently()
    {
        await using var db = NewDb();
        var firstSku = Guid.NewGuid();
        var secondSku = Guid.NewGuid();
        await SeedAsync(db, firstSku, onHand: 0, code: "FINISH-WH-1", warehouseQty: 5);
        await SeedAsync(db, secondSku, onHand: 1, code: "FINISH-WH-2", warehouseQty: 4);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            Req(Guid.NewGuid(), (firstSku, 3), (secondSku, 4)), Guid.NewGuid(), null);

        Assert.Equal(2, result.Lines.Count);
        Assert.Equal(3, result.Lines.Single(line => line.SkuId == firstSku).WarehouseDeductedQuantity);
        Assert.Equal(3, result.Lines.Single(line => line.SkuId == secondSku).WarehouseDeductedQuantity);
        Assert.All(result.Lines, line => Assert.Equal(0, line.PendingBomQuantity));
        // POS-06 (KB2): cả 2 SKU đều cần điều chuyển nên gom vào 1 queue chờ Thủ kho.
        Assert.Single(result.QueueIds);
        Assert.Equal(2, await db.StockDeductQueueItems.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task AcceptBackorder_CreatesInsufficientQueue_DeductsAvailableStock()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 1, code: "FINISH-BO");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-BO", warehouseQty: 0);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var request = Req(Guid.NewGuid(), (finishedSku, 3)) with { AcceptBackorder = true };
        var result = await logic.PreparePosStockDeductionAsync(request, Guid.NewGuid(), null);

        Assert.Equal("BackorderAccepted", result.StockHandlingMode);
        Assert.False(result.BackorderRequired);
        var queueId = Assert.Single(result.QueueIds);
        var queue = await db.Set<StockDeductQueue>().AsNoTracking()
            .Include(item => item.Items)
            .SingleAsync(item => item.Id == queueId);
        Assert.Equal(QueueStatus.Insufficient, queue.QueueStatus);
        Assert.Equal("waiting_materials", queue.OrderStockStatus);
        Assert.Equal(1, Assert.Single(queue.Items).FinishedDeductedQuantity);
        Assert.Equal(2, Assert.Single(queue.Items).PendingBomQuantity);

        var stock = await db.SkuStocks.AsNoTracking().SingleAsync(item => item.SkuId == finishedSku);
        Assert.Equal(0, stock.QuantityOnHand);
    }

    [Fact]
    public async Task AcceptBackorder_ZeroAvailableStock_CreatesInsufficientQueueWithoutDeduction()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 0, code: "FINISH-BO-ZERO");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-BO-ZERO", warehouseQty: 0);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var request = Req(Guid.NewGuid(), (finishedSku, 2)) with { AcceptBackorder = true };
        var result = await logic.PreparePosStockDeductionAsync(request, Guid.NewGuid(), null);

        Assert.Equal("BackorderAccepted", result.StockHandlingMode);
        var queueId = Assert.Single(result.QueueIds);
        var queue = await db.Set<StockDeductQueue>().AsNoTracking()
            .Include(item => item.Items)
            .SingleAsync(item => item.Id == queueId);
        Assert.Equal(QueueStatus.Insufficient, queue.QueueStatus);
        Assert.Equal(0, Assert.Single(queue.Items).FinishedDeductedQuantity);
        Assert.Equal(2, Assert.Single(queue.Items).PendingBomQuantity);

        var stock = await db.SkuStocks.AsNoTracking().SingleAsync(item => item.SkuId == finishedSku);
        Assert.Equal(0, stock.QuantityOnHand);
    }

    [Fact]
    public async Task AcceptBackorder_PreviewOnly_HasNoStockOrQueueSideEffects()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 1, code: "FINISH-PREVIEW");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-PREVIEW", warehouseQty: 0);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var request = Req(Guid.NewGuid(), (finishedSku, 2)) with
        {
            AcceptBackorder = true,
            PreviewOnly = true
        };
        var result = await logic.PreparePosStockDeductionAsync(request, Guid.NewGuid(), null);

        Assert.Equal("BackorderAccepted", result.StockHandlingMode);
        Assert.Empty(result.QueueIds);
        Assert.Empty(await db.Set<StockDeductQueue>().AsNoTracking().ToListAsync());
        var stock = await db.SkuStocks.AsNoTracking().SingleAsync(item => item.SkuId == finishedSku);
        Assert.Equal(1, stock.QuantityOnHand);
    }

    [Theory]
    [InlineData("CompleteDelivery")]
    [InlineData("PartialDelivery")]
    public async Task Backorder_Cancellation_RestoresFinishedStockAfterRequiredReturn(
        string fulfillmentPreference)
    {
        await using var db = NewDb();
        var orderId = Guid.NewGuid();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 1, code: "FINISH-HOLD");
        await SeedAsync(db, materialSku, onHand: 0, code: "MAT-HOLD", warehouseQty: 0);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var request = Req(orderId, (finishedSku, 2)) with
        {
            AcceptBackorder = true,
            FulfillmentPreference = fulfillmentPreference
        };
        await logic.PreparePosStockDeductionAsync(request, Guid.NewGuid(), null);
        Assert.Equal(0, (await db.SkuStocks.AsNoTracking()
            .SingleAsync(item => item.SkuId == finishedSku)).QuantityOnHand);

        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = "BACKORDER-HOLD",
            PreviousOrderStatus = "WaitingMaterials",
            Items = []
        });

        Assert.Equal(1, (await db.SkuStocks.AsNoTracking()
            .SingleAsync(item => item.SkuId == finishedSku)).QuantityOnHand);
        var queue = await db.Set<StockDeductQueue>().AsNoTracking()
            .SingleAsync(item => item.OrderId == orderId);
        Assert.Equal(QueueStatus.Cancelled, queue.QueueStatus);
    }

    [Fact]
    public async Task CancelStockQueuesForOrder_WaitingTransfer_BlocksConfirmAndRestoresShelf()
    {
        await using var db = NewDb();
        var orderId = Guid.NewGuid();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 3, code: "FINISH-VOID", warehouseQty: 10);

        var logic = BuildLogic(db);
        var prepare = await logic.PreparePosStockDeductionAsync(
            Req(orderId, (sku, 7)), Guid.NewGuid(), null);
        Assert.Equal("WarehouseTransferPending", prepare.StockHandlingMode);
        var queueId = Assert.Single(prepare.QueueIds);

        var afterPrepare = await db.SkuStocks.AsNoTracking().SingleAsync(s => s.SkuId == sku);
        Assert.Equal(0, afterPrepare.QuantityOnHand);
        Assert.Equal(10, afterPrepare.WarehouseQuantityOnHand);

        var cancel = await logic.CancelStockQueuesForOrderAsync(
            new CancelStockQueuesForOrderRequest(orderId, "Sale hủy đơn", "WaitingTransfer"),
            Guid.NewGuid(),
            null);
        Assert.True(cancel.Changed);
        Assert.Equal("cancelled", cancel.QueueStatus);

        var queue = await db.Set<StockDeductQueue>().AsNoTracking().SingleAsync(q => q.Id == queueId);
        Assert.Equal(QueueStatus.Cancelled, queue.QueueStatus);

        var afterCancel = await db.SkuStocks.AsNoTracking().SingleAsync(s => s.SkuId == sku);
        Assert.Equal(3, afterCancel.QuantityOnHand);
        Assert.Equal(10, afterCancel.WarehouseQuantityOnHand);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ConfirmQueueAsync(queueId, Guid.NewGuid(), null));
    }

    [Fact]
    public async Task FreezeStockQueues_CancellationRequested_BlocksConfirm()
    {
        await using var db = NewDb();
        var orderId = Guid.NewGuid();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 0, code: "FINISH-FREEZE", warehouseQty: 8);

        var logic = BuildLogic(db);
        var prepare = await logic.PreparePosStockDeductionAsync(
            Req(orderId, (sku, 4)), Guid.NewGuid(), null);
        var queueId = Assert.Single(prepare.QueueIds);

        await logic.FreezeStockQueuesForOrderCancellationAsync(orderId, "Chờ duyệt hủy", default);

        var ex = await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ConfirmQueueAsync(queueId, Guid.NewGuid(), null));
        Assert.Contains("hủy", ex.Message, StringComparison.OrdinalIgnoreCase);

        await logic.UnfreezeStockQueuesForOrderCancellationAsync(orderId, default);
        // Unfreeze alone does not guarantee Confirm success (need WH stock / transfer path); only that status cleared.
        var queue = await db.Set<StockDeductQueue>().AsNoTracking().SingleAsync(q => q.Id == queueId);
        Assert.Equal("pending", queue.OrderStockStatus);
    }

    // ── COD ReserveOnly: không trừ Kệ lúc tạo; reserve + 3 mode giống POS ──

    private static PreparePosStockDeductionRequest CodReq(Guid orderId, params (Guid skuId, int qty)[] lines) =>
        Req(orderId, lines) with { OrderStatus = "PendingPayment", ReserveOnly = true };

    [Fact]
    public async Task CodReserveOnly_ShelfSufficient_ReservesWithoutDeducting()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 10);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            CodReq(Guid.NewGuid(), (sku, 4)), Guid.NewGuid(), null);

        Assert.Equal("ImmediateFinishedStockOnly", result.StockHandlingMode);
        Assert.False(result.HasPendingStockReconciliation);
        Assert.Single(result.QueueIds);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(10, stock.QuantityOnHand);
        Assert.Equal(4, stock.ReservedQuantity);

        var queue = await db.Set<StockDeductQueue>().AsNoTracking()
            .Include(q => q.Items)
            .SingleAsync(q => q.Id == result.QueueIds[0]);
        Assert.True(queue.IsReserved);
        Assert.Equal(4, queue.Items.Sum(i => i.Quantity));
        Assert.Equal(4, queue.Items.Sum(i => i.ReservedQuantity));
    }

    [Fact]
    public async Task CodReserveOnly_ShelfShort_WarehouseCovers_QueuesTransfer_NoShelfDeduct()
    {
        await using var db = NewDb();
        var sku = Guid.NewGuid();
        await SeedAsync(db, sku, onHand: 2, code: "COD-WH", warehouseQty: 10);

        var logic = BuildLogic(db);
        var result = await logic.PreparePosStockDeductionAsync(
            CodReq(Guid.NewGuid(), (sku, 7)), Guid.NewGuid(), null);

        Assert.Equal("WarehouseTransferPending", result.StockHandlingMode);
        Assert.True(result.HasPendingStockReconciliation);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == sku);
        Assert.Equal(2, stock.QuantityOnHand);
        Assert.Equal(2, stock.ReservedQuantity);
        Assert.Equal(10, stock.WarehouseQuantityOnHand);

        var item = await db.Set<StockDeductQueueItem>().AsNoTracking()
            .SingleAsync(i => i.QueueId == result.QueueIds[0]);
        Assert.Equal(7, item.Quantity);
        Assert.Equal(2, item.FinishedDeductedQuantity);
        Assert.Equal(5, item.WarehouseTransferQuantity);
        Assert.Equal(2, item.ReservedQuantity);
    }

    [Fact]
    public async Task CodReserveOnly_NeedsBom_CreatesPendingQueue_NoShelfDeduct()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 1, code: "COD-BOM-F", warehouseQty: 0);
        await SeedAsync(db, materialSku, onHand: 0, code: "COD-BOM-M", warehouseQty: 20);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var result = await logic.PreparePosStockDeductionAsync(
            CodReq(Guid.NewGuid(), (finishedSku, 3)), Guid.NewGuid(), null);

        Assert.Equal("PartialOrFullPendingBomReconciliation", result.StockHandlingMode);
        Assert.True(result.HasPendingStockReconciliation);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(1, stock.QuantityOnHand);
        Assert.Equal(1, stock.ReservedQuantity);

        var item = await db.Set<StockDeductQueueItem>().AsNoTracking()
            .SingleAsync(i => i.QueueId == result.QueueIds[0]);
        Assert.Equal(3, item.Quantity);
        Assert.Equal(1, item.FinishedDeductedQuantity);
        Assert.Equal(2, item.PendingBomQuantity);
    }

    [Fact]
    public async Task CodReserveOnly_MaterialShortage_AcceptBackorder_InsufficientQueue()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 0, code: "COD-BO-F", warehouseQty: 0);
        await SeedAsync(db, materialSku, onHand: 0, code: "COD-BO-M", warehouseQty: 0);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var logic = BuildLogic(db, catalogClient.Object);
        var result = await logic.PreparePosStockDeductionAsync(
            CodReq(Guid.NewGuid(), (finishedSku, 2)) with { AcceptBackorder = true },
            Guid.NewGuid(),
            null);

        Assert.Equal("BackorderAccepted", result.StockHandlingMode);
        Assert.True(result.HasPendingStockReconciliation);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == finishedSku);
        Assert.Equal(0, stock.QuantityOnHand);
        Assert.Equal(0, stock.ReservedQuantity);

        var queue = await db.Set<StockDeductQueue>().AsNoTracking()
            .SingleAsync(q => q.Id == result.QueueIds[0]);
        Assert.Equal(QueueStatus.Insufficient, queue.QueueStatus);
        Assert.Equal("waiting_materials", queue.OrderStockStatus);
    }

    [Fact]
    public async Task CodLegacyQueue_PreviewAndConfirm_EnrichesBom_LikePos()
    {
        await using var db = NewDb();
        var finishedSku = Guid.NewGuid();
        var materialSku = Guid.NewGuid();
        await SeedAsync(db, finishedSku, onHand: 1, code: "COD-LEGACY-F", warehouseQty: 0, reserved: 1);
        await SeedAsync(db, materialSku, onHand: 0, code: "COD-LEGACY-M", warehouseQty: 50);

        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient
            .Setup(c => c.GetCatalogForVariantIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildCatalogWithBom(finishedSku, materialSku, bomQty: 1m));

        var productionOrders = new List<ProductionOrder>();
        var productionRepo = new Mock<IProductionOrderRepository>();
        productionRepo
            .Setup(r => r.CountCreatedSinceAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        productionRepo
            .Setup(r => r.AddAsync(It.IsAny<ProductionOrder>(), It.IsAny<CancellationToken>()))
            .Callback<ProductionOrder, CancellationToken>((o, _) => productionOrders.Add(o))
            .Returns(Task.CompletedTask);
        productionRepo
            .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var logic = BuildLogicWithProduction(db, catalogClient.Object, productionRepo.Object);

        var orderId = Guid.NewGuid();
        var queue = new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            OrderCode = "COD-LEGACY-1",
            OrderPaymentStatus = "pending",
            OrderStockStatus = "pending_deduct",
            QueueStatus = QueueStatus.Waiting,
            TotalAmount = 100m,
            IsReserved = true,
            IsDeducted = false,
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    SkuId = finishedSku,
                    SkuSnapshotName = "Thành phẩm",
                    SkuSnapshotCode = "COD-LEGACY-F",
                    Quantity = 3,
                    OrderedQuantity = 3,
                    ReservedQuantity = 1,
                    ReservationStatus = StockReservationStatus.Active,
                    ReservedAt = DateTime.UtcNow,
                }
            ]
        };
        foreach (var item in queue.Items)
            item.QueueId = queue.Id;
        db.Set<StockDeductQueue>().Add(queue);
        await db.SaveChangesAsync();

        var preview = await logic.PreviewQueueAsync(queue.Id);
        Assert.True(preview.IsBomReconciliation);
        Assert.True(preview.WillCreateProductionOrder);
        Assert.True(preview.WillCreateStockTransfer);

        var itemAfterPreview = await db.Set<StockDeductQueueItem>().AsNoTracking()
            .SingleAsync(i => i.QueueId == queue.Id);
        Assert.Equal(2, itemAfterPreview.PendingBomQuantity);
        Assert.False(string.IsNullOrWhiteSpace(itemAfterPreview.MaterialRequirementSnapshotJson));

        var confirm = await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);
        Assert.True(confirm.CanDeduct);
        Assert.Single(productionOrders);
        Assert.StartsWith("SX-", productionOrders[0].ProductionCode);

        var finished = await db.SkuStocks.AsNoTracking().SingleAsync(s => s.SkuId == finishedSku);
        Assert.Equal(0, finished.QuantityOnHand);
        Assert.Equal(0, finished.ReservedQuantity);

        var material = await db.SkuStocks.AsNoTracking().SingleAsync(s => s.SkuId == materialSku);
        Assert.Equal(48, material.WarehouseQuantityOnHand);
    }

    private static InventoryLogic BuildLogicWithProduction(
        InventoryDbContext db,
        IProductCatalogClient catalogClient,
        IProductionOrderRepository productionRepo)
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
            productionRepo,
            Mock.Of<IStockTransferRepository>(),
            catalogClient,
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            new ReturnInspectionRepository(db),
            Mock.Of<INotificationClient>(),
            opts);
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private static ProductCatalogSnapshot BuildCatalogWithBom(
        Guid finishedSku, Guid materialSku, decimal bomQty)
    {
        var materialVariant = new CatalogVariant(
            materialSku, Guid.NewGuid(), "MAT-CODE", "Nguyên liệu",
            IsActive: true, IsSellable: false, HasBom: false, BomLineCount: 0, BomLines: [],
            CanBeBomComponent: true);
        var materialProduct = new CatalogProduct(
            Guid.NewGuid(), "Nguyên liệu", "NGUYEN_LIEU", "gram", "gram",
            IsActive: true, Variants: [materialVariant]);

        var bomLine = new CatalogBomLine(
            materialProduct.Id, "Nguyên liệu", "gram", bomQty,
            ComponentVariantId: materialSku, ComponentSkuCode: "MAT-CODE",
            ComponentVariantName: "Nguyên liệu", IsRequiredBaseComponent: false);

        var finishedVariant = new CatalogVariant(
            finishedSku, Guid.NewGuid(), "FINISH-CODE", "Thành phẩm",
            IsActive: true, IsSellable: true, HasBom: true, BomLineCount: 1, BomLines: [bomLine],
            CanHaveBom: true);
        var finishedProduct = new CatalogProduct(
            Guid.NewGuid(), "Thành phẩm", "THANH_PHAM", "cái", "cái",
            IsActive: true, Variants: [finishedVariant]);

        return new ProductCatalogSnapshot([finishedProduct, materialProduct]);
    }

    // ── Custom materials sell-first ─────────────────────────────────────────

    private static PrepareCustomMaterialsRequest CustomReq(
        Guid orderId,
        params (Guid skuId, int qty)[] lines) =>
        new(
            orderId,
            $"HVT-{orderId:N}"[..10],
            lines.Select(l => new PreparePosStockDeductionItemRequest(l.skuId, "NL", "NL-CODE", l.qty)).ToList());

    [Fact]
    public async Task CustomMaterials_SufficientWarehouse_ReturnsImmediate_NoDeduct()
    {
        await using var db = NewDb();
        var skuId = Guid.NewGuid();
        await SeedAsync(db, skuId, onHand: 0, warehouseQty: 10, code: "NL-A");
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        var result = await logic.PrepareCustomMaterialsAsync(
            CustomReq(orderId, (skuId, 5)),
            CancellationToken.None);

        Assert.Equal("Immediate", result.StockHandlingMode);
        Assert.False(result.BackorderRequired);
        Assert.Equal(10, (await db.SkuStocks.SingleAsync()).WarehouseQuantityOnHand);
        Assert.Equal(5, result.Lines.Single().FinishedDeductedQuantity);
        Assert.Equal(0, result.Lines.Single().PendingBomQuantity);
    }

    [Fact]
    public async Task CustomMaterials_Shortage_WithoutAccept_ReturnsBackorderRequired()
    {
        await using var db = NewDb();
        var skuId = Guid.NewGuid();
        await SeedAsync(db, skuId, onHand: 0, warehouseQty: 2, code: "NL-B");
        var logic = BuildLogic(db);

        var result = await logic.PrepareCustomMaterialsAsync(
            CustomReq(Guid.NewGuid(), (skuId, 5)) with { AcceptBackorder = false },
            CancellationToken.None);

        Assert.Equal("BackorderRequired", result.StockHandlingMode);
        Assert.True(result.BackorderRequired);
        Assert.Equal(2, result.Lines.Single().FinishedDeductedQuantity);
        Assert.Equal(3, result.Lines.Single().PendingBomQuantity);
        Assert.Equal(2, (await db.SkuStocks.SingleAsync()).WarehouseQuantityOnHand);
    }

    [Fact]
    public async Task CustomMaterials_Shortage_WithAccept_ReturnsBackorderAccepted_NoDeduct()
    {
        await using var db = NewDb();
        var skuId = Guid.NewGuid();
        await SeedAsync(db, skuId, onHand: 0, warehouseQty: 1, code: "NL-C");
        var logic = BuildLogic(db);

        var result = await logic.PrepareCustomMaterialsAsync(
            CustomReq(Guid.NewGuid(), (skuId, 4)) with { AcceptBackorder = true },
            CancellationToken.None);

        Assert.Equal("BackorderAccepted", result.StockHandlingMode);
        Assert.False(result.BackorderRequired);
        Assert.Equal(1, (await db.SkuStocks.SingleAsync()).WarehouseQuantityOnHand);
    }
}
