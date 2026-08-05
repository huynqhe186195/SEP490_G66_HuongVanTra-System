using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
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
/// Phase Trả hàng nhập (Kho -> NCC) một bước: Thủ kho tạo phiếu, tồn Kho trừ ngay trong cùng
/// transaction và phiếu chốt luôn ở trạng thái Completed. Không còn bước duyệt thứ hai.
/// </summary>
public class SupplierReturnSingleStepTests
{
    private static readonly Guid SkuA = Guid.Parse("a1a1a1a1-0001-0001-0001-a1a1a1a1a1a1");
    private static readonly Guid ProductId = Guid.Parse("c3c3c3c3-0003-0003-0003-c3c3c3c3c3c3");
    private static readonly Guid ReceiptId = Guid.Parse("d4d4d4d4-0004-0004-0004-d4d4d4d4d4d4");
    private static readonly Guid BatchNear = Guid.Parse("11110000-0000-0000-0000-000000000001");
    private static readonly Guid BatchFar = Guid.Parse("11110000-0000-0000-0000-000000000002");
    private const string EvidenceUrl = "https://res.cloudinary.com/demo/image/upload/defect.jpg";

    private static InventoryDbContext NewDb() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"srr-{Guid.NewGuid():N}").Options);

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
            new SupplierReturnRequestRepository(db),
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

    private static WarehouseBatch Batch(Guid batchId, string lotCode, DateTime? expiresAt, int quantity)
    {
        var now = DateTime.UtcNow;
        return new WarehouseBatch
        {
            Id = batchId,
            LotCode = lotCode,
            SourceType = "supplier_receipt",
            Location = "Warehouse",
            Status = "active",
            ExpiresAt = expiresAt,
            CreatedBy = InventoryTestActors.Warehouse,
            CreatedAt = now,
            UpdatedAt = now,
            Items =
            [
                new WarehouseBatchItem
                {
                    Id = Guid.NewGuid(),
                    WarehouseBatchId = batchId,
                    SkuId = SkuA,
                    SkuCode = "NL-A-001",
                    ProductSnapshotName = "SKU A",
                    InitialQuantity = quantity,
                    QuantityOnHand = quantity,
                    CreatedAt = now,
                    UpdatedAt = now,
                },
            ],
        };
    }

    /// <summary>Hai lô cùng SKU: lô cận date (BatchNear) phải được FEFO ưu tiên trước.</summary>
    private static void SeedBaseline(InventoryDbContext db, int nearQuantity = 30, int farQuantity = 20)
    {
        var today = DateTime.UtcNow.Date;
        db.SupplierReceipts.Add(new SupplierReceipt
        {
            Id = ReceiptId,
            ReceiptCode = "PN-20260101-0001",
            SupplierName = "NCC Thử Nghiệm",
            SupplierReference = "NCC-REF-001",
            ReceivedDate = today,
            Status = SupplierReceiptStatus.Completed,
            CreatedBy = InventoryTestActors.Warehouse,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SkuStocks.Add(InventoryWorkflowTestBuilders.SkuStock(
            SkuA, "NL-A-001", warehouseQuantity: nearQuantity + farQuantity, shelfQuantity: 7));
        db.WarehouseBatches.Add(Batch(BatchNear, "LOT-NEAR", today.AddDays(10), nearQuantity));
        db.WarehouseBatches.Add(Batch(BatchFar, "LOT-FAR", today.AddDays(90), farQuantity));
        db.SaveChanges();
    }

    private static CreateSupplierReturnRequest Payload(
        Guid operationId,
        params InventoryReturnItemRequest[] items) =>
        new(
            operationId,
            ReceiptId,
            "PN-20260101-0001",
            "NCC Thử Nghiệm",
            "NCC-REF-001",
            "DAMAGED_ON_ARRIVAL",
            new List<string> { EvidenceUrl },
            "Hàng móp méo khi nhận",
            "Ghi chú kiểm tra",
            items.ToList());

    private static InventoryReturnItemRequest Item(int quantity, Guid? batchId = null, string? lotCode = null) =>
        new(SkuA, "NL-A-001", "SKU A", quantity, batchId, lotCode, null);

    private static CreatorSnapshot Snapshot() =>
        new(InventoryTestActors.Warehouse, "Thủ kho", "Warehouse");

    private static Task<SupplierReturnRequestResponse> CreateAsync(
        InventoryLogic logic, CreateSupplierReturnRequest request) =>
        logic.CreateSupplierReturnRequestAsync(request, InventoryTestActors.Warehouse, Snapshot());

    private static async Task AssertNoStockMovementAsync(InventoryDbContext db)
    {
        Assert.Empty(db.SupplierReturnRequests);
        Assert.Empty(db.SupplierReturnEvidenceImages);
        Assert.Equal(0, await db.StockExportSlips.CountAsync());
        Assert.Equal(0, await db.InventoryLedgerEntries.CountAsync());
        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(50, stock.WarehouseQuantityOnHand);
        Assert.All(await db.WarehouseBatchItems.ToListAsync(), i => Assert.Equal(i.InitialQuantity, i.QuantityOnHand));
    }

    // (1) Tạo phiếu là chốt luôn: trừ tồn Kho, status Completed, sinh phiếu xuất + ledger.
    [Fact]
    public async Task Create_DeductsWarehouseImmediately_AndCompletesInOneStep()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        var created = await CreateAsync(logic, Payload(Guid.NewGuid(), Item(12)));

        Assert.Equal("completed", created.Status.ToLowerInvariant());
        Assert.StartsWith("THN-", created.ReturnCode);
        Assert.Equal("DAMAGED_ON_ARRIVAL", created.DefectReasonCode);
        Assert.Equal([EvidenceUrl], created.EvidenceImageUrls);

        var stored = await db.SupplierReturnRequests.Include(r => r.Items).SingleAsync();
        Assert.Equal(InventoryReturnRequestStatus.Completed, stored.Status);
        var line = Assert.Single(stored.Items);
        Assert.Equal(50, line.WarehouseQtyBefore);
        Assert.Equal(38, line.WarehouseQtyAfter);
        Assert.Equal(7, line.ShelfQtyBefore);
        Assert.Equal(7, line.ShelfQtyAfter);
        Assert.NotNull(line.StockExportSlipId);

        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA);
        Assert.Equal(38, stock.WarehouseQuantityOnHand);
        Assert.Equal(7, stock.QuantityOnHand);

        Assert.Equal(1, await db.StockExportSlips.CountAsync());
        var ledger = await db.InventoryLedgerEntries.SingleAsync();
        Assert.Equal("SUPPLIER_RETURN", ledger.TransactionType);
        Assert.Equal(-12, ledger.QuantityDelta);
        Assert.Equal(38, ledger.QuantityAfter);
    }

    // (2) FEFO: lô cận date bị trừ trước, lô xa date chỉ bị chạm khi lô gần đã hết.
    [Fact]
    public async Task Create_AllocatesBatchesByFefo()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await CreateAsync(logic, Payload(Guid.NewGuid(), Item(35)));

        var near = await db.WarehouseBatchItems.SingleAsync(i => i.WarehouseBatchId == BatchNear);
        var far = await db.WarehouseBatchItems.SingleAsync(i => i.WarehouseBatchId == BatchFar);
        Assert.Equal(0, near.QuantityOnHand);
        Assert.Equal(15, far.QuantityOnHand);
        Assert.Equal("depleted", (await db.WarehouseBatches.SingleAsync(b => b.Id == BatchNear)).Status);
        Assert.Equal("active", (await db.WarehouseBatches.SingleAsync(b => b.Id == BatchFar)).Status);
    }

    // (3) Idempotency: gửi lại cùng OperationId trả về đúng phiếu cũ, không trừ tồn lần hai.
    [Fact]
    public async Task Create_WithSameOperationId_IsIdempotent()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var operationId = Guid.NewGuid();

        var first = await CreateAsync(logic, Payload(operationId, Item(12)));
        var second = await CreateAsync(logic, Payload(operationId, Item(12)));

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(first.ReturnCode, second.ReturnCode);
        Assert.Equal(1, await db.SupplierReturnRequests.CountAsync());
        Assert.Equal(1, await db.StockExportSlips.CountAsync());
        Assert.Equal(1, await db.InventoryLedgerEntries.CountAsync());
        Assert.Equal(38, (await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA)).WarehouseQuantityOnHand);
    }

    // (4) Thiếu OperationId thì chặn — không có khoá chống trùng thì không cho ghi.
    [Fact]
    public async Task Create_WithoutOperationId_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(Guid.Empty, Item(5))));

        await AssertNoStockMovementAsync(db);
    }

    // (5) Phiếu nhập gốc là bắt buộc để truy vết trả về đúng NCC.
    [Fact]
    public async Task Create_WithoutSourceSupplierReceipt_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var request = Payload(Guid.NewGuid(), Item(5)) with { SupplierReceiptId = Guid.Empty };

        await Assert.ThrowsAsync<InventoryValidationException>(() => CreateAsync(logic, request));

        await AssertNoStockMovementAsync(db);
    }

    // (6) Ảnh hàng lỗi là bằng chứng hậu kiểm bắt buộc, và phải là link https.
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("http://res.cloudinary.com/demo/image/upload/defect.jpg")]
    public async Task Create_WithInvalidEvidenceImage_IsRejected(string evidence)
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var request = Payload(Guid.NewGuid(), Item(5)) with { EvidenceImageUrls = [evidence] };

        await Assert.ThrowsAsync<InventoryValidationException>(() => CreateAsync(logic, request));

        await AssertNoStockMovementAsync(db);
    }

    // (6b) Không có ảnh nào (list rỗng hoặc null) cũng bị chặn.
    [Fact]
    public async Task Create_WithoutAnyEvidenceImage_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(Guid.NewGuid(), Item(5)) with { EvidenceImageUrls = [] }));

        await AssertNoStockMovementAsync(db);
    }

    // (6c) Đính kèm nhiều ảnh: giữ nguyên thứ tự và loại bỏ link trùng.
    [Fact]
    public async Task Create_WithMultipleEvidenceImages_KeepsOrderAndDeduplicates()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var first = $"{EvidenceUrl}?v=1";
        var second = $"{EvidenceUrl}?v=2";
        var request = Payload(Guid.NewGuid(), Item(5)) with { EvidenceImageUrls = [first, second, first] };

        var created = await CreateAsync(logic, request);

        Assert.Equal([first, second], created.EvidenceImageUrls);
        var stored = await db.SupplierReturnEvidenceImages
            .OrderBy(i => i.SortOrder)
            .ToListAsync();
        Assert.Equal([0, 1], stored.Select(i => i.SortOrder));
        Assert.Equal([first, second], stored.Select(i => i.ImageUrl));
    }

    // (6d) Quá 5 ảnh bị chặn — trần bằng chứng hậu kiểm.
    [Fact]
    public async Task Create_WithMoreThanMaxEvidenceImages_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var urls = Enumerable.Range(1, SupplierReturnRequest.MaxEvidenceImages + 1)
            .Select(i => $"{EvidenceUrl}?v={i}")
            .ToList();

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(Guid.NewGuid(), Item(5)) with { EvidenceImageUrls = urls }));

        await AssertNoStockMovementAsync(db);
    }

    // (7) Lý do lỗi phải nằm trong danh mục chuẩn hoá.
    [Fact]
    public async Task Create_WithUnknownDefectReason_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var request = Payload(Guid.NewGuid(), Item(5)) with { DefectReasonCode = "KHONG_TON_TAI" };

        await Assert.ThrowsAsync<InventoryValidationException>(() => CreateAsync(logic, request));

        await AssertNoStockMovementAsync(db);
    }

    // (8) Lý do "Khác" bắt buộc mô tả chi tiết, nếu không phiếu mất giá trị hậu kiểm.
    [Fact]
    public async Task Create_WithOtherDefectReasonAndBlankDescription_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);
        var request = Payload(Guid.NewGuid(), Item(5)) with { DefectReasonCode = "OTHER", Reason = "  " };

        await Assert.ThrowsAsync<InventoryValidationException>(() => CreateAsync(logic, request));

        await AssertNoStockMovementAsync(db);
    }

    // (9) Kho không đủ tồn thì chặn toàn bộ phiếu, không ghi nhận từng phần.
    [Fact]
    public async Task Create_WithInsufficientWarehouseStock_IsRejectedAndPostsNothing()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(Guid.NewGuid(), Item(51))));

        await AssertNoStockMovementAsync(db);
    }

    // (10) Trùng SKU + lô trong cùng phiếu bị chặn để tránh trừ tồn hai lần một dòng.
    [Fact]
    public async Task Create_WithDuplicateSkuAndBatchLine_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(
                Guid.NewGuid(),
                Item(5, BatchNear, "LOT-NEAR"),
                Item(3, BatchNear, "LOT-NEAR"))));

        await AssertNoStockMovementAsync(db);
    }

    // (11) Chọn lô cụ thể thì phải trừ đúng lô đó, không rơi về FEFO.
    [Fact]
    public async Task Create_WithExplicitBatch_DeductsThatBatchOnly()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await CreateAsync(logic, Payload(Guid.NewGuid(), Item(8, BatchFar, "LOT-FAR")));

        Assert.Equal(30, (await db.WarehouseBatchItems.SingleAsync(i => i.WarehouseBatchId == BatchNear)).QuantityOnHand);
        Assert.Equal(12, (await db.WarehouseBatchItems.SingleAsync(i => i.WarehouseBatchId == BatchFar)).QuantityOnHand);
        Assert.Equal(42, (await db.SkuStocks.SingleAsync(s => s.SkuId == SkuA)).WarehouseQuantityOnHand);
    }

    // (12) Phiếu rỗng không được tạo.
    [Fact]
    public async Task Create_WithNoLines_IsRejected()
    {
        using var db = NewDb();
        SeedBaseline(db);
        var logic = BuildLogic(db);

        await Assert.ThrowsAsync<InventoryValidationException>(() =>
            CreateAsync(logic, Payload(Guid.NewGuid())));

        await AssertNoStockMovementAsync(db);
    }

    // (13) Danh mục lý do lỗi phải phục vụ được dropdown và có nhánh "Khác".
    [Fact]
    public void DefectReasonCatalog_IsExposedWithOtherOption()
    {
        var reasons = InventoryLogic.GetSupplierReturnDefectReasons();

        Assert.NotEmpty(reasons);
        Assert.Contains(reasons, r => r.Code == "OTHER");
        Assert.All(reasons, r =>
        {
            Assert.False(string.IsNullOrWhiteSpace(r.Code));
            Assert.False(string.IsNullOrWhiteSpace(r.Label));
        });
    }
}
