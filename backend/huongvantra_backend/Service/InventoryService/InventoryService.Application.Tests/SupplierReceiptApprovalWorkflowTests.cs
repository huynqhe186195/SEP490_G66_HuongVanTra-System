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
using InventoryService.Infrastructure.Repositories;
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
                new CatalogVariant(SkuA, ProductId, "NL-A-001", "SKU A", true, false, false, 0, []),
                new CatalogVariant(SkuB, ProductId, "NL-B-002", "SKU B", true, false, false, 0, []),
            ]),
    ]);

    private static InventoryLogic BuildLogic(InventoryDbContext db)
    {
        var opts = MSOptions.Create(new InventoryOptions { SimulateWarehouse = false });
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
            Mock.Of<IShelfReturnRequestRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            Mock.Of<IProductionOrderRepository>(),
            new FakeCatalogClient(BuildCatalog()),
            new SupplierRepository(db),
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

    private static SupplierReceiptItemRequest Line(Guid skuId, string skuCode, string lotCode, decimal quantity)
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
            10_000m,
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
            BuildRequest("HD-0001", Line(SkuA, "NL-A-001", "LOT-A-0001", 20)),
            InventoryTestActors.Warehouse,
            Snapshot(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse"));

        var stored = await db.SupplierReceipts.Include(r => r.Items).SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Draft, stored.Status);
        Assert.Single(stored.Items);
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

        var completed = await db.SupplierReceipts.SingleAsync(r => r.Id == created.Id);
        Assert.Equal(SupplierReceiptStatus.Completed, completed.Status);
        Assert.Equal(InventoryTestActors.Manager, completed.ReviewedBy);

        await logic.ApproveSupplierReceiptAsync(
            created.Id,
            InventoryTestActors.Manager,
            Snapshot(InventoryTestActors.Manager, "Quản lý", "Manager"));

        var afterSecond = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(20, afterSecond.WarehouseQuantityOnHand);
        Assert.Equal(1, await db.WarehouseBatches.CountAsync());
        Assert.Equal(1, await db.StockImportSlips.CountAsync());
        Assert.Equal(1, await db.InventoryLedgerEntries.CountAsync());
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
        await logic.SubmitSupplierReceiptAsync(created.Id, InventoryTestActors.Warehouse);

        // Lô của dòng thứ hai bị chiếm bởi một lô kho khác trước khi duyệt.
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            LotCode = "LOT-B-0010",
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
