using System.Reflection;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.Tests.TestSupport;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Messaging;
using InventoryService.Infrastructure.Repositories;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Moq;
using MSOptions = Microsoft.Extensions.Options.Options;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// Phiếu nhập NCC: tạo là Completed + áp tồn Kho ngay (không chờ Manager duyệt).
/// </summary>
public class SupplierReceiptApprovalWorkflowTests
{
    private static readonly Guid SupplierId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid SkuA = Guid.Parse("a1a1a1a1-0001-0001-0001-a1a1a1a1a1a1");
    private static readonly Guid SkuB = Guid.Parse("b2b2b2b2-0002-0002-0002-b2b2b2b2b2b2");
    private static readonly Guid ProductId = Guid.Parse("c3c3c3c3-0003-0003-0003-c3c3c3c3c3c3");

    private static InventoryDbContext NewDb() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"sr-{Guid.NewGuid():N}").Options);

    private sealed class InMemorySkuStockRepo(InventoryDbContext db) : ISkuStockRepository
    {
        public Task<SkuStock?> GetBySkuIdAsync(Guid id, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == id, ct);

        public Task<SkuStock?> GetBySkuIdWithLockAsync(Guid id, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == id, ct);

        public Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default) =>
            db.SkuStocks.OrderBy(s => s.SkuCode).ToListAsync(ct);

        public async Task AddAsync(SkuStock s, CancellationToken ct = default) => await db.SkuStocks.AddAsync(s, ct);

        public Task<int> SaveChangesAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);
    }

    private sealed class PassThrough : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private sealed class FakeCatalogClient(ProductCatalogSnapshot snapshot) : IProductCatalogClient
    {
        public Task<ProductCatalogSnapshot> GetCatalogAsync(CancellationToken ct = default) =>
            Task.FromResult(snapshot);

        public Task<ProductCatalogSnapshot> GetCatalogForVariantIdsAsync(
            IEnumerable<Guid> variantIds, CancellationToken ct = default) => Task.FromResult(snapshot);

        public Task<ProductCatalogSnapshot> GetSupplierReceiptCatalogForVariantIdsAsync(
            IEnumerable<Guid> variantIds, CancellationToken ct = default) => Task.FromResult(snapshot);
    }

    private static ProductCatalogSnapshot BuildCatalog() => new(
    [
        new CatalogProduct(
            ProductId,
            "Nguyên liệu thử nghiệm",
            "NGUYEN_LIEU",
            "Piece",
            "Piece",
            true,
            [
                new CatalogVariant(
                    SkuA, ProductId, "NL-A-001", "SKU A", true, false, false, 0, [],
                    IsPurchasable: true,
                    UnitName: "gói"),
                new CatalogVariant(
                    SkuB, ProductId, "NL-B-002", "SKU B", true, false, false, 0, [],
                    IsPurchasable: true),
            ]),
    ]);

    private static InventoryLogic BuildLogic(InventoryDbContext db)
    {
        var opts = MSOptions.Create(new InventoryOptions { SimulateWarehouse = false });
        var eventPublisher = new InventoryEventPublisher(Mock.Of<IPublishEndpoint>(), db);
        return new InventoryLogic(
            new InMemorySkuStockRepo(db),
            new StockDeductQueueRepository(db),
            Mock.Of<IStockAdjustmentRequestRepository>(),
            new StockExportSlipRepository(db),
            new StockImportSlipRepository(db),
            new WarehouseBatchRepository(db),
            new StockExportBatchAllocationRepository(db),
            new InventoryLedgerRepository(db),
            new SupplierReceiptRepository(db),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            new ProcessedIntegrationEventRepository(db),
            eventPublisher,
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            new FakeCatalogClient(BuildCatalog()),
            new SupplierRepository(db),
            new SupplierProductRepository(db),
            new ReturnInspectionRepository(db),
            Mock.Of<HuongVanTra.Shared.Notifications.INotificationClient>(),
            opts);
    }

    private static void SeedBaseline(InventoryDbContext db)
    {
        db.Suppliers.Add(new Supplier
        {
            Id = SupplierId,
            Name = "NCC Thử Nghiệm",
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SkuStocks.Add(InventoryWorkflowTestBuilders.SkuStock(SkuA, "NL-A-001", warehouseQuantity: 0, shelfQuantity: 0));
        db.SkuStocks.Add(InventoryWorkflowTestBuilders.SkuStock(SkuB, "NL-B-002", warehouseQuantity: 0, shelfQuantity: 0));
        db.SaveChanges();
    }

    private static SupplierReceiptItemRequest Line(
        Guid skuId,
        string skuCode,
        string lotCode,
        decimal quantity,
        decimal? unitCost = 10_000m)
    {
        var received = DateTime.UtcNow.Date;
        return new SupplierReceiptItemRequest(
            skuId,
            skuCode,
            skuCode,
            "NGUYEN_LIEU",
            "Piece",
            null,
            quantity,
            unitCost,
            lotCode,
            received.AddDays(-2),
            received.AddDays(30),
            null);
    }

    private static UpsertSupplierReceiptRequest BuildRequest(
        string documentNumber,
        params SupplierReceiptItemRequest[] lines)
    {
        var received = DateTime.UtcNow.Date;
        return new UpsertSupplierReceiptRequest(
            SupplierId,
            "NCC Thử Nghiệm",
            "NCC-REF-001",
            documentNumber,
            received,
            received,
            "Phiếu nhập thử nghiệm",
            lines.ToList());
    }

    private static CreatorSnapshot Snapshot(Guid actorId, string name, string role) =>
        new(actorId, name, role);

    private static async Task AssertNoStockMovementAsync(InventoryDbContext db)
    {
        Assert.Equal(0, await db.WarehouseBatches.CountAsync());
        Assert.Equal(0, await db.StockImportSlips.CountAsync());
        Assert.Equal(0, await db.InventoryLedgerEntries.CountAsync());
        Assert.Equal(0, await db.InventoryOutboxMessages.CountAsync());
        Assert.All(await db.SkuStocks.ToListAsync(), s =>
        {
            Assert.Equal(0, s.WarehouseQuantityOnHand);
            Assert.Equal(0, s.QuantityOnHand);
        });
    }

    // (1) Create hoàn tất ngay và tăng tồn Kho — không chờ Manager duyệt.
    [Fact]
    public async Task CreateSupplierReceipt_CompletesImmediately_AndIncreasesWarehouseStock()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0001", Line(SkuA, "CLIENT-SPOOF", " Lot-A-Mixed ", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Completed, stored.Status);
        Assert.Equal(InventoryTestActors.Warehouse, stored.SubmittedBy);
        Assert.Single(stored.Items);
        Assert.Equal(10_000m, stored.Items.Single().UnitCost);
        Assert.Equal(20m, stored.Items.Single().DocumentQuantity);
        Assert.Equal(200_000m, stored.Items.Single().LineAmount);
        Assert.Equal("NL-A-001", stored.Items.Single().SkuCode);
        Assert.Equal("Lot-A-Mixed", stored.Items.Single().LotCode);
        Assert.Equal("gói", stored.Items.Single().InventoryUnitSnapshot);
        Assert.Equal(200_000m, stored.TotalAmount);

        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, stock.WarehouseQuantityOnHand);
        Assert.Equal(0, stock.QuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.Equal(10_000m, (await db.WarehouseBatches.Include(b => b.Items).SingleAsync()).Items.Single().UnitCost);
        Assert.Equal(1, await db.StockImportSlips.CountAsync());
        Assert.Equal(1, await db.InventoryLedgerEntries.CountAsync());
    }

    [Fact]
    public async Task CreateSupplierReceipt_AllowsSameSkuWithDifferentSupplierLots()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest(
                "HD-MULTI-LOT",
                Line(SkuA, "NL-A-001", "LOT-A", 10),
                Line(SkuA, "NL-A-001", "LOT-B", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        Assert.Equal("completed", created.Status);
        Assert.Equal(2, created.Items.Count);
        Assert.Equal(2, await db.WarehouseBatches.CountAsync());
        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(30, stock.WarehouseQuantityOnHand);
    }

    [Fact]
    public async Task CreateSupplierReceipt_RejectsExactDuplicateLotIdentity()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest(
                    "HD-EXACT-DUP",
                    Line(SkuA, "NL-A-001", " lot-a ", 10),
                    Line(SkuA, "NL-A-001", "LOT-A", 20)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Empty(db.SupplierReceipts);
        await AssertNoStockMovementAsync(db);
    }

    [Fact]
    public async Task CreateSupplierReceipt_AllowsDifferentSkusWithSameSupplierLot()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest(
                "HD-SHARED-LOT",
                Line(SkuA, "NL-A-001", "LOT-SHARED", 10),
                Line(SkuB, "NL-B-002", "LOT-SHARED", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        Assert.Equal("completed", created.Status);
        Assert.Equal(2, created.Items.Count);
    }

    [Fact]
    public async Task CreateSupplierReceipt_RejectsMissingLotAndDates()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var incomplete = Line(SkuA, "NL-A-001", string.Empty, 10) with
        {
            ManufacturedAt = null,
            ExpiresAt = null
        };

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-INCOMPLETE", incomplete),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Empty(db.SupplierReceipts);
        await AssertNoStockMovementAsync(db);
    }

    [Theory]
    [InlineData("LOT A")]
    [InlineData("LÔ-01")]
    [InlineData("lot@1")]
    public async Task CreateSupplierReceipt_RejectsInvalidLotCodeFormat(string lotCode)
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var error = await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-BAD-LOT", Line(SkuA, "NL-A-001", lotCode, 10)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Contains("Mã lô NCC", error.Message);
        Assert.Empty(db.SupplierReceipts);
        await AssertNoStockMovementAsync(db);
    }

    [Theory]
    [InlineData(1.5)]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CreateSupplierReceipt_RejectsNonNaturalQuantity(decimal quantity)
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-BAD-QUANTITY", Line(SkuA, "NL-A-001", "LOT-QTY", quantity)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));
    }

    [Fact]
    public async Task CreateSupplierReceipt_RejectsMissingUnitCost()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var error = await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-NULL-COST", Line(SkuA, "NL-A-001", "LOT-NULL-COST", 20, unitCost: null)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Contains("Đơn giá", error.Message);
        Assert.Empty(db.SupplierReceipts);
        await AssertNoStockMovementAsync(db);
    }

    [Fact]
    public async Task SubmitCompletedReceipt_IsIdempotent()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0003", Line(SkuA, "NL-A-001", "LOT-A-0003", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var again = await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        Assert.Equal("completed", again.Status);
        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, stock.WarehouseQuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
    }

    [Fact]
    public async Task ApproveCompletedReceipt_IsIdempotent()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0005", Line(SkuA, "NL-A-001", "LOT-A-0005", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await logic.ApproveSupplierReceiptAsync(
            created.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        var after = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, after.WarehouseQuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.Equal(1, await db.StockImportSlips.CountAsync());
    }

    [Fact]
    public async Task CreateSupplierReceipt_CreatesOneInternalBatchPerSupplierLot()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var completed = await logic.CreateSupplierReceiptAsync(
            BuildRequest(
                "HD-MULTI-APPROVE",
                Line(SkuA, "NL-A-001", " Lot-A-Mixed ", 10),
                Line(SkuA, "NL-A-001", "LOT-B", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var batches = await db.WarehouseBatches
            .Include(batch => batch.Items)
            .OrderBy(batch => batch.LotCode)
            .ToListAsync();
        Assert.Equal(2, batches.Count);
        Assert.Equal(["Lot-A-Mixed", "LOT-B"], batches.Select(batch => batch.LotCode).ToArray());
        Assert.All(batches, batch =>
        {
            Assert.StartsWith("SR-", batch.BatchCode);
            Assert.Single(batch.Items);
            Assert.Equal(SkuA, batch.Items.Single().SkuId);
        });
        Assert.Equal(
            batches.Select(batch => batch.BatchCode).OrderBy(code => code),
            completed.Items.Select(item => item.WarehouseBatchLotCode).OrderBy(code => code));

        var repository = new WarehouseBatchRepository(db);
        Assert.Single(await repository.GetListAsync(null, batches[0].BatchCode, false));
        Assert.Single(await repository.GetListAsync(null, "lot-a-mixed", false));
    }

    [Fact]
    public async Task DuplicateSupplierDocumentNumber_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-DUP-01", Line(SkuA, "NL-A-001", "LOT-A-0006", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-DUP-01", Line(SkuB, "NL-B-002", "LOT-B-0007", 5)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Equal(1, await db.SupplierReceipts.CountAsync());
        var skuB = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuB);
        Assert.Equal(0, skuB.WarehouseQuantityOnHand);
    }

    [Fact]
    public async Task MultiLineApprove_FailingLine_PostsNothing()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var pendingId = Guid.NewGuid();
        var lineAId = Guid.NewGuid();
        var lineBId = Guid.NewGuid();
        var received = DateTime.UtcNow.Date;
        db.SupplierReceipts.Add(new SupplierReceipt
        {
            Id = pendingId,
            ReceiptCode = "NCC-PENDING-0010",
            SupplierId = SupplierId,
            SupplierName = "NCC Thử Nghiệm",
            SupplierNameSnapshot = "NCC Thử Nghiệm",
            SupplierDocumentNumber = "HD-0010",
            SupplierDocumentDate = received,
            ReceivedDate = received,
            Status = SupplierReceiptStatus.PendingApproval,
            CreatedBy = InventoryTestActors.Warehouse,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            SubmittedBy = InventoryTestActors.Warehouse,
            SubmittedAt = DateTime.UtcNow,
            Items =
            {
                new SupplierReceiptItem
                {
                    Id = lineAId,
                    SupplierReceiptId = pendingId,
                    SkuId = SkuA,
                    SkuCode = "NL-A-001",
                    SkuNameSnapshot = "SKU A",
                    ProductTypeSnapshot = "NGUYEN_LIEU",
                    InventoryUnitSnapshot = "gói",
                    SubmittedQuantity = 20,
                    DocumentQuantity = 20,
                    Quantity = 20,
                    UnitCost = 10_000m,
                    LineAmount = 200_000m,
                    LotCode = "LOT-A-0010",
                    ManufacturedAt = received.AddDays(-2),
                    ExpiresAt = received.AddDays(30),
                    ActualReceivedQuantity = 20,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                },
                new SupplierReceiptItem
                {
                    Id = lineBId,
                    SupplierReceiptId = pendingId,
                    SkuId = SkuB,
                    SkuCode = "NL-B-002",
                    SkuNameSnapshot = "SKU B",
                    ProductTypeSnapshot = "NGUYEN_LIEU",
                    InventoryUnitSnapshot = "Piece",
                    SubmittedQuantity = 30,
                    DocumentQuantity = 30,
                    Quantity = 30,
                    UnitCost = 10_000m,
                    LineAmount = 300_000m,
                    LotCode = "LOT-B-0010",
                    ManufacturedAt = received.AddDays(-2),
                    ExpiresAt = received.AddDays(30),
                    ActualReceivedQuantity = 30,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                },
            },
        });
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = $"SR-{lineBId.ToString("N")[..8]}".ToUpperInvariant(),
            LotCode = "CONFLICT-LOT",
            Location = "Warehouse",
            Status = "active",
            SourceType = "conflict",
            CreatedBy = InventoryTestActors.Admin,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ApproveSupplierReceiptAsync(
                pendingId,
                InventoryTestActors.Manager,
                Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager")));

        var stored = await db.SupplierReceipts.SingleAsync(r => r.Id == pendingId);
        Assert.Equal(SupplierReceiptStatus.PendingApproval, stored.Status);
        Assert.Null(stored.StockImportSlipId);
        Assert.Equal(0, await db.StockImportSlips.CountAsync());
        Assert.Equal(0, await db.InventoryLedgerEntries.CountAsync());
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.All(await db.SkuStocks.ToListAsync(), s => Assert.Equal(0, s.WarehouseQuantityOnHand));
    }

    // (11) Không còn flow bypass approval; chỉ một method duy nhất ghi tồn.
    [Fact]
    public void InventoryLogic_HasNoReceiveSupplierReceiptBypass()
    {
        var methods = typeof(InventoryLogic)
            .GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
            .Select(m => m.Name)
            .ToList();

        Assert.DoesNotContain(methods, name => name.Contains("ReceiveSupplierReceipt", StringComparison.Ordinal));

        var applyMethod = typeof(InventoryLogic).GetMethod(
            "ApplySupplierReceiptToWarehouseAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(applyMethod);
        Assert.False(applyMethod!.IsPublic);
    }
}
