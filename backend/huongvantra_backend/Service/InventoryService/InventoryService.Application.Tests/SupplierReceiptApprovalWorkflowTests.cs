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
/// Phase Supplier Receipt: canonical workflow Draft -> PendingApproval -> Completed.
/// Chỉ Approve mới được thay đổi tồn Warehouse.
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

    // (1) Create Draft không tăng stock.
    [Fact]
    public async Task CreateSupplierReceipt_LeavesStockUntouched_AndStaysDraft()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0001", Line(SkuA, "CLIENT-SPOOF", " Lot-A-Mixed ", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        Assert.Single(stored.Items);
        Assert.Equal(10_000m, stored.Items.Single().UnitCost);
        Assert.Equal(20m, stored.Items.Single().DocumentQuantity);
        Assert.Equal(200_000m, stored.Items.Single().LineAmount);
        Assert.Equal("NL-A-001", stored.Items.Single().SkuCode);
        Assert.Equal("Lot-A-Mixed", stored.Items.Single().LotCode);
        Assert.Equal("gói", stored.Items.Single().InventoryUnitSnapshot);
        Assert.Equal(200_000m, stored.TotalAmount);
        await AssertNoStockMovementAsync(db);
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

        Assert.Equal(2, created.Items.Count);
        await AssertNoStockMovementAsync(db);
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

        Assert.Equal(2, created.Items.Count);
    }

    [Fact]
    public async Task Draft_AllowsMissingLotAndDates_ButSubmitRejects()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var incomplete = Line(SkuA, "NL-A-001", string.Empty, 10) with
        {
            ManufacturedAt = null,
            ExpiresAt = null
        };

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-INCOMPLETE-DRAFT", incomplete),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse));
        Assert.Equal(SupplierReceiptStatus.Draft, (await db.SupplierReceipts.SingleAsync()).Status);
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
    public async Task SubmitSupplierReceipt_RejectsMissingUnitCost()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-NULL-COST", Line(SkuA, "NL-A-001", "LOT-NULL-COST", 20, unitCost: null)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var error = await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse));

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Contains("Đơn giá", error.Message);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        Assert.Null(stored.Items.Single().UnitCost);
        await AssertNoStockMovementAsync(db);
    }

    [Fact]
    public async Task ApproveSupplierReceipt_RevalidatesNonPositiveUnitCost()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-INVALID-COST", Line(SkuA, "NL-A-001", "LOT-INVALID-COST", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        var storedItem = await db.SupplierReceiptItems.SingleAsync(item => item.SupplierReceiptId == created.Id);
        storedItem.UnitCost = 0;
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ApproveSupplierReceiptAsync(
                created.Id,
                InventoryTestActors.Manager,
                Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager")));

        Assert.Contains("Đơn giá", error.Message);
        var stored = await db.SupplierReceipts.SingleAsync(receipt => receipt.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.PendingApproval, stored.Status);
        await AssertNoStockMovementAsync(db);
    }

    // (2) Update Draft không tăng stock.
    [Fact]
    public async Task UpdateSupplierReceipt_LeavesStockUntouched()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0002", Line(SkuA, "NL-A-001", "LOT-A-0002", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await logic.UpdateSupplierReceiptAsync(
            created.Id,
            BuildRequest("HD-0002", Line(SkuA, "NL-A-001", "LOT-A-0002B", 35)),
            InventoryTestActors.Warehouse);

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        Assert.Equal(35, stored.Items.Single().Quantity);
        await AssertNoStockMovementAsync(db);
    }

    // (3) Submit không tăng stock. (4) Warehouse có thể Submit.
    [Fact]
    public async Task WarehouseCreator_CanSubmit_WithoutChangingStock()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0003", Line(SkuA, "NL-A-001", "LOT-A-0003", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        var stored = await db.SupplierReceipts.SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.PendingApproval, stored.Status);
        Assert.Equal(InventoryTestActors.Warehouse, stored.SubmittedBy);
        await AssertNoStockMovementAsync(db);
    }

    // (5) Creator tự Approve bị từ chối.
    [Fact]
    public async Task Creator_CannotApproveOwnReceipt()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0004", Line(SkuA, "NL-A-001", "LOT-A-0004", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.ApproveSupplierReceiptAsync(
                created.Id,
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        var stored = await db.SupplierReceipts.SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.PendingApproval, stored.Status);
        await AssertNoStockMovementAsync(db);
    }

    // (6) Reviewer Approve tăng Warehouse đúng một lần. (7) Approve lặp không tăng lần hai.
    [Fact]
    public async Task ReviewerApprove_IncreasesWarehouseOnce_AndIsIdempotent()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0005", Line(SkuA, "NL-A-001", "LOT-A-0005", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        await logic.ApproveSupplierReceiptAsync(
            created.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        var afterFirst = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, afterFirst.WarehouseQuantityOnHand);
        Assert.Equal(0, afterFirst.QuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.Equal(1, await db.StockImportSlips.CountAsync());
        Assert.Equal(1, await db.InventoryLedgerEntries.CountAsync());
        Assert.Equal(1, await db.InventoryOutboxMessages.CountAsync());
        var createdBatch = await db.WarehouseBatches.Include(b => b.Items).SingleAsync();
        Assert.Null(createdBatch.Items.Single().UnitCost);
        Assert.StartsWith("SR-", createdBatch.BatchCode);
        Assert.Equal("LOT-A-0005", createdBatch.LotCode);
        Assert.NotEqual(createdBatch.Items.Single().SkuCode, createdBatch.BatchCode);
        Assert.NotEqual(createdBatch.Items.Single().SkuCode, createdBatch.LotCode);

        var completed = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Completed, completed.Status);
        Assert.Equal(InventoryTestActors.Manager, completed.ReviewedBy);
        Assert.Equal(createdBatch.BatchCode, completed.Items.Single().WarehouseBatchLotCode);

        await logic.ApproveSupplierReceiptAsync(
            created.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        var afterSecond = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, afterSecond.WarehouseQuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.Equal(1, await db.StockImportSlips.CountAsync());
        Assert.Equal(1, await db.InventoryLedgerEntries.CountAsync());
        Assert.Equal(1, await db.InventoryOutboxMessages.CountAsync());
    }

    [Fact]
    public async Task ReviewerApprove_CreatesOneInternalBatchPerSupplierLot_AndSearchesBothCodes()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest(
                "HD-MULTI-APPROVE",
                Line(SkuA, "NL-A-001", " Lot-A-Mixed ", 10),
                Line(SkuA, "NL-A-001", "LOT-B", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);
        var completed = await logic.ApproveSupplierReceiptAsync(
            created.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        var batches = await db.WarehouseBatches
            .Include(batch => batch.Items)
            .OrderBy(batch => batch.LotCode)
            .ToListAsync();
        Assert.Equal(2, batches.Count);
        Assert.Equal(2, batches.Select(batch => batch.BatchCode).Distinct().Count());
        Assert.Equal(["Lot-A-Mixed", "LOT-B"], batches.Select(batch => batch.LotCode).ToArray());
        Assert.All(batches, batch =>
        {
            Assert.StartsWith("SR-", batch.BatchCode);
            Assert.Single(batch.Items);
            Assert.Equal(SkuA, batch.Items.Single().SkuId);
            Assert.Equal("NL-A-001", batch.Items.Single().SkuCode);
            Assert.DoesNotContain("NL-A-001", batch.BatchCode);
            Assert.DoesNotContain("NL-A-001", batch.LotCode);
        });
        Assert.Equal(
            batches.Select(batch => batch.BatchCode).OrderBy(code => code),
            completed.Items.Select(item => item.WarehouseBatchLotCode).OrderBy(code => code));

        var repository = new WarehouseBatchRepository(db);
        Assert.Single(await repository.GetListAsync(null, batches[0].BatchCode, false));
        Assert.Single(await repository.GetListAsync(null, "lot-a-mixed", false));
    }

    // (8) Duplicate supplier document bị từ chối.
    [Fact]
    public async Task DuplicateSupplierDocumentNumber_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var first = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-DUP-01", Line(SkuA, "NL-A-001", "LOT-A-0006", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        await logic.SubmitSupplierReceiptAsync(first.Id, InventoryTestActors.Warehouse);
        await logic.ApproveSupplierReceiptAsync(
            first.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.CreateSupplierReceiptAsync(
                BuildRequest("HD-DUP-01", Line(SkuB, "NL-B-002", "LOT-B-0007", 5)),
                InventoryTestActors.Warehouse,
                Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse")));

        Assert.Equal(1, await db.SupplierReceipts.CountAsync());
        var skuB = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuB);
        Assert.Equal(0, skuB.WarehouseQuantityOnHand);
    }

    // (9) Validation được áp dụng lại khi Update.
    [Fact]
    public async Task Update_ReappliesSharedDocumentValidation()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0008", Line(SkuA, "NL-A-001", "LOT-A-0008", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.UpdateSupplierReceiptAsync(
                created.Id,
                BuildRequest("HD 0008 *", Line(SkuA, "NL-A-001", "LOT-A-0008B", 20)),
                InventoryTestActors.Warehouse));

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal("HD-0008", stored.SupplierDocumentNumber);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        await AssertNoStockMovementAsync(db);
    }

    // (9) Validation được áp dụng lại khi Submit.
    [Fact]
    public async Task Submit_ReappliesSharedDocumentValidation()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest("HD-0009", Line(SkuA, "NL-A-001", "LOT-A-0009", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        // Nhà cung cấp bị ngừng hoạt động sau khi phiếu đã được tạo.
        var supplier = await db.Suppliers.SingleAsync(s => s.Id == SupplierId);
        supplier.IsDeleted = true;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse));

        var stored = await db.SupplierReceipts.SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        await AssertNoStockMovementAsync(db);
    }

    // (10) Multi-line failure rollback toàn bộ.
    [Fact]
    public async Task MultiLineApprove_FailingLine_PostsNothing()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await logic.CreateSupplierReceiptAsync(
            BuildRequest(
                "HD-0010",
                Line(SkuA, "NL-A-001", "LOT-A-0010", 20),
                Line(SkuB, "NL-B-002", "LOT-B-0010", 30)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));
        var secondLineId = (await db.SupplierReceipts
                .Include(receipt => receipt.Items)
                .SingleAsync(receipt => receipt.Id == created.Id))
            .Items.Single(item => item.SkuId == SkuB).Id;
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        // Mã lô nội bộ sinh từ line thứ hai bị chiếm trước khi duyệt.
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = $"SR-{secondLineId.ToString("N")[..8]}".ToUpperInvariant(),
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
                created.Id,
                InventoryTestActors.Manager,
                Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager")));

        var stored = await db.SupplierReceipts.SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.PendingApproval, stored.Status);
        Assert.Null(stored.StockImportSlipId);
        Assert.Equal(0, await db.StockImportSlips.CountAsync());
        Assert.Equal(0, await db.InventoryLedgerEntries.CountAsync());
        // Chỉ còn lô xung đột được seed sẵn: không có lô nào được tạo cho dòng 1.
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
