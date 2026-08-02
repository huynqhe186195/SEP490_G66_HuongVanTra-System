using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
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

public sealed class StockTransferLogicTests
{
    private static readonly Guid ActorId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SkuA = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid SkuB = Guid.Parse("20000000-0000-0000-0000-000000000002");

    [Fact]
    public async Task CreateAsync_ActiveFinishedProduct_CreatesDraftWithoutStockEffect()
    {
        StockTransfer? added = null;
        var transferRepo = new Mock<IStockTransferRepository>();
        transferRepo.Setup(repo => repo.AddAsync(It.IsAny<StockTransfer>(), It.IsAny<CancellationToken>()))
            .Callback<StockTransfer, CancellationToken>((transfer, _) => added = transfer)
            .Returns(Task.CompletedTask);
        transferRepo.Setup(repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            Catalog("THANH_PHAM", true, true, SkuA));

        var response = await logic.CreateAsync(
            new UpsertStockTransferRequest(
                "Điều chuyển thử nghiệm",
                [new UpsertStockTransferLineRequest(SkuA, "CLIENT-CODE", null, null, 3)]),
            ActorId,
            new CreatorSnapshot(ActorId, "Warehouse User", "Warehouse"));

        Assert.NotNull(added);
        Assert.Equal(StockTransferStatus.Draft, added.Status);
        Assert.Equal(ActorId, added.CreatedBy);
        Assert.Equal("Warehouse", added.SourceLocation);
        Assert.Equal("Shelf", added.DestinationLocation);
        Assert.Equal("SKU-A", added.Lines.Single().SkuCode);
        Assert.Equal("draft", response.Status);
        stockRepo.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("NGUYEN_LIEU")]
    [InlineData("BAO_BI")]
    [InlineData("")]
    [InlineData(null)]
    public async Task CreateAsync_NonFinishedOrInvalidProductType_RejectsBeforePersistence(string? productType)
    {
        var transferRepo = new Mock<IStockTransferRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            transferRepo,
            new Mock<ISkuStockRepository>(),
            Catalog(productType!, true, true, SkuA));

        await Assert.ThrowsAsync<InventoryValidationException>(() => logic.CreateAsync(
            new UpsertStockTransferRequest(
                null,
                [new UpsertStockTransferLineRequest(SkuA, null, null, null, 1)]),
            ActorId,
            null));

        transferRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CompleteAsync_MixedSufficientAndInsufficientLines_DoesNotMutateAnyLine()
    {
        var transfer = Transfer(
            (SkuA, "SKU-A", 3),
            (SkuB, "SKU-B", 4));
        var stockA = Stock(SkuA, "SKU-A", warehouse: 10, shelf: 2, reserved: 1);
        var stockB = Stock(SkuB, "SKU-B", warehouse: 10, shelf: 5, reserved: 2);
        var (_, itemA) = SourceLot(SkuA, "SKU-A", "LOT-A", 3, DateTime.UtcNow.AddDays(5));
        var (_, itemB) = SourceLot(SkuB, "SKU-B", "LOT-B", 2, DateTime.UtcNow.AddDays(5));

        var transferRepo = TransferRepositoryForCompletion(transfer, claimResult: true);
        var stockRepo = new Mock<ISkuStockRepository>();
        stockRepo.Setup(repo => repo.GetBySkuIdWithLockAsync(SkuA, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockA);
        stockRepo.Setup(repo => repo.GetBySkuIdWithLockAsync(SkuB, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockB);
        var batchRepo = new Mock<IWarehouseBatchRepository>();
        batchRepo.Setup(repo => repo.GetAvailableItemsForSkuAsync(SkuA, "Warehouse", It.IsAny<CancellationToken>()))
            .ReturnsAsync([itemA]);
        batchRepo.Setup(repo => repo.GetAvailableItemsForSkuAsync(SkuB, "Warehouse", It.IsAny<CancellationToken>()))
            .ReturnsAsync([itemB]);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            Catalog("THANH_PHAM", true, true, SkuA, SkuB),
            batchRepo);

        await Assert.ThrowsAsync<InventoryValidationException>(
            () => logic.CompleteAsync(transfer.Id, ActorId, null));

        Assert.Equal(3, itemA.QuantityOnHand);
        Assert.Equal(2, itemB.QuantityOnHand);
        Assert.Equal((10, 2, 1), (stockA.WarehouseQuantityOnHand, stockA.QuantityOnHand, stockA.ReservedQuantity));
        Assert.Equal((10, 5, 2), (stockB.WarehouseQuantityOnHand, stockB.QuantityOnHand, stockB.ReservedQuantity));
        transferRepo.Verify(repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        batchRepo.Verify(repo => repo.AddAsync(It.IsAny<WarehouseBatch>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CompleteAsync_ValidFefoPlan_MovesStockAndCreatesLineageSlipsAndTwoSidedLedger()
    {
        var transfer = Transfer((SkuA, "SKU-A", 5));
        var stock = Stock(SkuA, "SKU-A", warehouse: 10, shelf: 2, reserved: 3);
        var (earlyBatch, earlyItem) = SourceLot(
            SkuA, "SKU-A", "LOT-EARLY", 2, DateTime.UtcNow.AddDays(3));
        var (lateBatch, lateItem) = SourceLot(
            SkuA, "SKU-A", "LOT-LATE", 5, DateTime.UtcNow.AddDays(10));
        var transferRepo = TransferRepositoryForCompletion(transfer, claimResult: true, setCompletedOnClaim: true);
        // Allocation được Add thẳng vào DbSet thay vì qua navigation của aggregate đang tracked,
        // nên phải bắt qua repository chứ không đọc transfer.BatchAllocations.
        List<StockTransferBatchAllocation> savedAllocations = [];
        transferRepo.Setup(repo => repo.AddBatchAllocationsAsync(
                It.IsAny<IEnumerable<StockTransferBatchAllocation>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<StockTransferBatchAllocation>, CancellationToken>(
                (rows, _) => savedAllocations = rows.ToList())
            .Returns(Task.CompletedTask);
        var stockRepo = new Mock<ISkuStockRepository>();
        stockRepo.Setup(repo => repo.GetBySkuIdWithLockAsync(SkuA, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stock);
        var destinationBatches = new List<WarehouseBatch>();
        var batchRepo = new Mock<IWarehouseBatchRepository>();
        batchRepo.Setup(repo => repo.GetAvailableItemsForSkuAsync(SkuA, "Warehouse", It.IsAny<CancellationToken>()))
            .ReturnsAsync([earlyItem, lateItem]);
        var storedBatchTotals = new Dictionary<Guid, int>
        {
            [earlyBatch.Id] = earlyItem.QuantityOnHand,
            [lateBatch.Id] = lateItem.QuantityOnHand,
        };
        batchRepo.Setup(repo => repo.GetQuantitySumsByBatchAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(storedBatchTotals);
        batchRepo.Setup(repo => repo.AddAsync(It.IsAny<WarehouseBatch>(), It.IsAny<CancellationToken>()))
            .Callback<WarehouseBatch, CancellationToken>((batch, _) => destinationBatches.Add(batch))
            .Returns(Task.CompletedTask);
        StockExportSlip? exportSlip = null;
        var exportRepo = new Mock<IStockExportSlipRepository>();
        exportRepo.Setup(repo => repo.AddAsync(It.IsAny<StockExportSlip>(), It.IsAny<CancellationToken>()))
            .Callback<StockExportSlip, CancellationToken>((slip, _) => exportSlip = slip)
            .Returns(Task.CompletedTask);
        StockImportSlip? importSlip = null;
        var importRepo = new Mock<IStockImportSlipRepository>();
        importRepo.Setup(repo => repo.AddAsync(It.IsAny<StockImportSlip>(), It.IsAny<CancellationToken>()))
            .Callback<StockImportSlip, CancellationToken>((slip, _) => importSlip = slip)
            .Returns(Task.CompletedTask);
        List<InventoryLedgerEntry> ledger = [];
        var ledgerRepo = new Mock<IInventoryLedgerRepository>();
        ledgerRepo.Setup(repo => repo.AddRangeAsync(
                It.IsAny<IEnumerable<InventoryLedgerEntry>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<InventoryLedgerEntry>, CancellationToken>((rows, _) => ledger = rows.ToList())
            .Returns(Task.CompletedTask);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            Catalog("THANH_PHAM", true, true, SkuA),
            batchRepo,
            exportRepo,
            importRepo,
            ledgerRepo);

        var response = await logic.CompleteAsync(
            transfer.Id,
            ActorId,
            new CreatorSnapshot(ActorId, "Warehouse User", "Warehouse"));

        Assert.Equal("completed", response.Status);
        Assert.Equal(5, stock.WarehouseQuantityOnHand);
        Assert.Equal(7, stock.QuantityOnHand);
        Assert.Equal(3, stock.ReservedQuantity);
        Assert.Equal(0, earlyItem.QuantityOnHand);
        Assert.Equal(2, lateItem.QuantityOnHand);
        Assert.Equal("depleted", earlyBatch.Status);
        Assert.Equal("active", lateBatch.Status);
        Assert.Equal(2, destinationBatches.Count);
        Assert.All(destinationBatches, batch =>
        {
            Assert.Equal("Shelf", batch.Location);
            Assert.Equal("stock_transfer", batch.SourceType);
            Assert.Equal(transfer.Id, batch.SourceReferenceId);
            Assert.Single(batch.Items);
        });
        Assert.Equal([2, 3], destinationBatches.Select(batch => batch.Items.Single().QuantityOnHand).ToArray());
        Assert.Equal(2, savedAllocations.Count);
        Assert.Equal(5, savedAllocations.Sum(allocation => allocation.Quantity));
        Assert.All(savedAllocations, allocation =>
        {
            Assert.NotEqual(Guid.Empty, allocation.SourceWarehouseBatchId);
            Assert.NotEqual(Guid.Empty, allocation.SourceWarehouseBatchItemId);
            Assert.NotEqual(Guid.Empty, allocation.DestinationWarehouseBatchId);
            Assert.NotEqual(Guid.Empty, allocation.DestinationWarehouseBatchItemId);
            Assert.Equal(transfer.Id, allocation.StockTransferId);
            Assert.Equal(transfer.Lines.Single().Id, allocation.StockTransferLineId);
        });
        Assert.NotNull(exportSlip);
        Assert.Equal("warehouse_to_shelf_transfer", exportSlip.ExportType);
        Assert.Equal(transfer.Id, exportSlip.ReferenceId);
        Assert.Equal(transfer.TransferCode, exportSlip.ReferenceCode);
        Assert.Equal(2, exportSlip.BatchAllocations.Count);
        Assert.NotNull(importSlip);
        Assert.Equal("warehouse_to_shelf_transfer", importSlip.ImportType);
        Assert.Equal(transfer.Id, importSlip.ReferenceId);
        Assert.Equal(2, importSlip.Lines.Count);
        Assert.Equal(4, ledger.Count);
        Assert.Equal(2, ledger.Count(row => row.TransactionType == "STOCK_TRANSFER_WAREHOUSE_OUT"));
        Assert.Equal(2, ledger.Count(row => row.TransactionType == "STOCK_TRANSFER_SHELF_IN"));
        Assert.All(ledger, row =>
        {
            Assert.Equal(transfer.Id, row.ReferenceId);
            Assert.Equal("StockTransfer", row.ReferenceType);
            Assert.Equal(ActorId, row.ActorId);
        });
        transferRepo.Verify(repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CompleteAsync_CatalogUnavailable_DoesNotClaimOrMutateStock()
    {
        var transfer = Transfer((SkuA, "SKU-A", 1));
        var transferRepo = new Mock<IStockTransferRepository>();
        transferRepo.Setup(repo => repo.GetByIdAsync(transfer.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(transfer);
        var catalogClient = new Mock<IProductCatalogClient>();
        catalogClient.Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("catalog unavailable"));
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            catalog: null,
            catalogClient: catalogClient);

        await Assert.ThrowsAsync<HttpRequestException>(
            () => logic.CompleteAsync(transfer.Id, ActorId, null));

        transferRepo.Verify(repo => repo.TryClaimDraftForCompletionAsync(
            It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
        stockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CompleteAsync_ClaimLostToCompletedRequest_ReturnsExistingWithoutSecondEffect()
    {
        var candidate = Transfer((SkuA, "SKU-A", 1));
        var completed = Transfer((SkuA, "SKU-A", 1));
        completed.Status = StockTransferStatus.Completed;
        completed.CompletedAt = DateTime.UtcNow;
        var transferRepo = new Mock<IStockTransferRepository>();
        transferRepo.SetupSequence(repo => repo.GetByIdAsync(candidate.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate)
            .ReturnsAsync(completed);
        transferRepo.Setup(repo => repo.TryClaimDraftForCompletionAsync(
                candidate.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            Catalog("THANH_PHAM", true, true, SkuA));

        var response = await logic.CompleteAsync(candidate.Id, ActorId, null);

        Assert.Equal("completed", response.Status);
        stockRepo.VerifyNoOtherCalls();
        transferRepo.Verify(repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CancelAsync_Draft_CreatesNoStockEffect()
    {
        var cancelled = Transfer((SkuA, "SKU-A", 2));
        cancelled.Status = StockTransferStatus.Cancelled;
        cancelled.CancelledBy = ActorId;
        cancelled.CancelledAt = DateTime.UtcNow;
        cancelled.CancellationReason = "Không còn nhu cầu";
        var transferRepo = new Mock<IStockTransferRepository>();
        transferRepo.Setup(repo => repo.TryCancelDraftAsync(
                cancelled.Id, ActorId, It.IsAny<DateTime>(), "Không còn nhu cầu", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        transferRepo.Setup(repo => repo.GetByIdAsync(cancelled.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cancelled);
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            transferRepo,
            stockRepo,
            Catalog("THANH_PHAM", true, true, SkuA));

        var response = await logic.CancelAsync(
            cancelled.Id,
            new CancelStockTransferRequest("Không còn nhu cầu"),
            ActorId);

        Assert.Equal("cancelled", response.Status);
        stockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task WarehouseBatchRepository_ReturnsAvailableWarehouseItemsInFefoOrder()
    {
        await using var db = new InventoryDbContext(
            new DbContextOptionsBuilder<InventoryDbContext>()
                .UseInMemoryDatabase($"stock-transfer-fefo-{Guid.NewGuid():N}")
                .Options);
        var now = DateTime.UtcNow;
        var late = SourceLot(SkuA, "SKU-A", "LOT-LATE", 5, now.AddDays(20), now.AddDays(-5));
        var earlyNew = SourceLot(SkuA, "SKU-A", "LOT-EARLY-NEW", 5, now.AddDays(5), now.AddDays(-2));
        var earlyOld = SourceLot(SkuA, "SKU-A", "LOT-EARLY-OLD", 5, now.AddDays(5), now.AddDays(-4));
        var noExpiry = SourceLot(SkuA, "SKU-A", "LOT-NO-EXPIRY", 5, null, now.AddDays(-10));
        db.WarehouseBatches.AddRange(late.Batch, earlyNew.Batch, earlyOld.Batch, noExpiry.Batch);
        await db.SaveChangesAsync();

        var result = await new WarehouseBatchRepository(db)
            .GetAvailableItemsForSkuAsync(SkuA, "Warehouse");

        Assert.Equal(
            [earlyOld.Item.Id, earlyNew.Item.Id, late.Item.Id, noExpiry.Item.Id],
            result.Select(item => item.Id).ToArray());
    }

    private static StockTransferLogic BuildLogic(
        Mock<IStockTransferRepository> transferRepo,
        Mock<ISkuStockRepository> stockRepo,
        ProductCatalogSnapshot? catalog,
        Mock<IWarehouseBatchRepository>? batchRepo = null,
        Mock<IStockExportSlipRepository>? exportRepo = null,
        Mock<IStockImportSlipRepository>? importRepo = null,
        Mock<IInventoryLedgerRepository>? ledgerRepo = null,
        Mock<IProductCatalogClient>? catalogClient = null,
        Mock<IStockAdjustmentRequestRepository>? adjustmentRequestRepo = null)
    {
        catalogClient ??= new Mock<IProductCatalogClient>();
        if (catalog is not null)
        {
            catalogClient.Setup(client => client.GetCatalogForVariantIdsAsync(
                    It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(catalog);
        }

        var unitOfWork = new Mock<IInventoryUnitOfWork>();
        unitOfWork.Setup(unit => unit.ExecuteInTransactionAsync(
                It.IsAny<Func<CancellationToken, Task<InventoryService.Application.DTOs.Responses.StockTransferResponse>>>(),
                It.IsAny<CancellationToken>()))
            .Returns((
                Func<CancellationToken, Task<InventoryService.Application.DTOs.Responses.StockTransferResponse>> action,
                CancellationToken ct) => action(ct));

        return new StockTransferLogic(
            transferRepo.Object,
            (adjustmentRequestRepo ?? new Mock<IStockAdjustmentRequestRepository>()).Object,
            stockRepo.Object,
            (batchRepo ?? new Mock<IWarehouseBatchRepository>()).Object,
            (exportRepo ?? new Mock<IStockExportSlipRepository>()).Object,
            (importRepo ?? new Mock<IStockImportSlipRepository>()).Object,
            (ledgerRepo ?? new Mock<IInventoryLedgerRepository>()).Object,
            catalogClient.Object,
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            unitOfWork.Object);
    }

    private static Mock<IStockTransferRepository> TransferRepositoryForCompletion(
        StockTransfer transfer,
        bool claimResult,
        bool setCompletedOnClaim = false)
    {
        var repo = new Mock<IStockTransferRepository>();
        repo.Setup(item => item.GetByIdAsync(transfer.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(transfer);
        var claim = repo.Setup(item => item.TryClaimDraftForCompletionAsync(
            transfer.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()));
        if (setCompletedOnClaim)
        {
            claim.Callback(() => transfer.Status = StockTransferStatus.Completed)
                .ReturnsAsync(claimResult);
        }
        else
        {
            claim.ReturnsAsync(claimResult);
        }
        repo.Setup(item => item.GetTrackedByIdAsync(transfer.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(transfer);
        repo.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return repo;
    }

    private static ProductCatalogSnapshot Catalog(
        string productType,
        bool productActive,
        bool variantActive,
        params Guid[] skuIds)
    {
        var productId = Guid.Parse("30000000-0000-0000-0000-000000000001");
        return new ProductCatalogSnapshot([
            new CatalogProduct(
                productId,
                "Thành phẩm thử nghiệm",
                productType,
                "Piece",
                "Cái",
                productActive,
                skuIds.Select((skuId, index) => new CatalogVariant(
                    skuId,
                    productId,
                    index == 0 ? "SKU-A" : "SKU-B",
                    index == 0 ? "SKU A" : "SKU B",
                    variantActive,
                    true,
                    false,
                    0,
                    [])).ToList())
        ]);
    }

    private static StockTransfer Transfer(params (Guid SkuId, string SkuCode, int Quantity)[] lines)
    {
        var transfer = new StockTransfer
        {
            Id = Guid.Parse("40000000-0000-0000-0000-000000000001"),
            TransferCode = "DC-TEST-001",
            Status = StockTransferStatus.Draft,
            SourceLocation = "Warehouse",
            DestinationLocation = "Shelf",
            CreatedBy = ActorId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        foreach (var line in lines)
        {
            transfer.Lines.Add(new StockTransferLine
            {
                Id = Guid.NewGuid(),
                StockTransferId = transfer.Id,
                SkuId = line.SkuId,
                SkuCode = line.SkuCode,
                SkuNameSnapshot = line.SkuCode,
                UnitNameSnapshot = "Piece",
                Quantity = line.Quantity,
                CreatedAt = transfer.CreatedAt,
            });
        }
        return transfer;
    }

    private static SkuStock Stock(
        Guid skuId,
        string skuCode,
        int warehouse,
        int shelf,
        int reserved) => new()
        {
            SkuId = skuId,
            SkuCode = skuCode,
            WarehouseQuantityOnHand = warehouse,
            QuantityOnHand = shelf,
            ReservedQuantity = reserved,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static (WarehouseBatch Batch, WarehouseBatchItem Item) SourceLot(
        Guid skuId,
        string skuCode,
        string lotCode,
        int quantity,
        DateTime? expiresAt,
        DateTime? createdAt = null)
    {
        var batch = new WarehouseBatch
        {
            Id = Guid.NewGuid(),
            LotCode = lotCode,
            ExpiresAt = expiresAt,
            Location = "Warehouse",
            Status = "active",
            CreatedBy = ActorId,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            UpdatedAt = createdAt ?? DateTime.UtcNow,
        };
        var item = new WarehouseBatchItem
        {
            Id = Guid.NewGuid(),
            WarehouseBatchId = batch.Id,
            SkuId = skuId,
            SkuCode = skuCode,
            ProductSnapshotName = skuCode,
            QuantityOnHand = quantity,
            InitialQuantity = quantity,
            CreatedAt = batch.CreatedAt,
            UpdatedAt = batch.CreatedAt,
            Batch = batch,
        };
        batch.Items.Add(item);
        return (batch, item);
    }
}
