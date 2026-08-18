using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.Tests.TestSupport;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

public sealed class StockAdjustmentShelfCatalogGuardTests
{
    [Theory]
    [InlineData("NGUYEN_LIEU")]
    [InlineData("BAO_BI")]
    [InlineData("")]
    public async Task ReviewStockAdjustmentRequest_NonFinishedOrInvalidProductType_RejectsBeforeStockMutation(string productType)
    {
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var logic = BuildLogic(
            InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest(),
            new ProductCatalogSnapshot([
                new CatalogProduct(Guid.NewGuid(), "Catalog product", productType, "Piece", "Cái", true,
                    [new CatalogVariant(InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest().Items[0].SkuId,
                        Guid.NewGuid(), "SKU-TEST", "SKU test", true, true, false, 0, [])])
            ]),
            stockRepo.Object);

        await Assert.ThrowsAsync<InventoryValidationException>(
            () => logic.ReviewStockAdjustmentRequestAsync(
                InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest().Id,
                Guid.NewGuid(), null));

        stockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ReviewStockAdjustmentRequest_MissingSkuInCatalog_RejectsBeforeStockMutation()
    {
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var request = InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest();
        var logic = BuildLogic(request, new ProductCatalogSnapshot([]), stockRepo.Object);

        await Assert.ThrowsAsync<InventoryValidationException>(
            () => logic.ReviewStockAdjustmentRequestAsync(request.Id, Guid.NewGuid(), null));

        stockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ReviewStockAdjustmentRequest_InactiveSku_RejectsBeforeStockMutation()
    {
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var request = InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest();
        var catalog = new ProductCatalogSnapshot([
            new CatalogProduct(Guid.NewGuid(), "Thành phẩm", "THANH_PHAM", "Piece", "Cái", true,
                [new CatalogVariant(request.Items[0].SkuId, Guid.NewGuid(), "TP-INACTIVE", "TP inactive", false, true, false, 0, [])])
        ]);
        var logic = BuildLogic(request, catalog, stockRepo.Object);

        await Assert.ThrowsAsync<InventoryValidationException>(
            () => logic.ReviewStockAdjustmentRequestAsync(request.Id, Guid.NewGuid(), null));

        stockRepo.VerifyNoOtherCalls();
    }

    /// <summary>
    /// Duyệt chỉ chốt số lượng được duyệt theo từng dòng. Bước duyệt không được chạm vào tồn kho;
    /// tồn kho chỉ thay đổi khi hoàn tất phiếu điều chuyển.
    /// </summary>
    [Fact]
    public async Task ReviewStockAdjustmentRequest_ActiveFinishedSku_ApprovesWithoutTouchingStock()
    {
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var request = InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest();
        var catalog = new ProductCatalogSnapshot([
            new CatalogProduct(Guid.NewGuid(), "Thành phẩm", "THANH_PHAM", "Piece", "Cái", true,
                [new CatalogVariant(request.Items[0].SkuId, Guid.NewGuid(), "TP-VALID", "TP valid", true, true, false, 0, [])])
        ]);
        var logic = BuildLogic(request, catalog, stockRepo.Object);

        var response = await logic.ReviewStockAdjustmentRequestAsync(request.Id, Guid.NewGuid(), null);

        Assert.Equal(request.Items[0].QuantityDelta, request.Items[0].ApprovedQuantity);
        Assert.Equal(0, request.Items[0].FulfilledQuantity);
        Assert.Equal(StockAdjustmentRequestItemStatus.WaitingForStock, request.Items[0].Status);
        Assert.Equal(StockAdjustmentRequestStatus.Approved, request.Status);
        Assert.NotNull(response);
        stockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ReviewStockAdjustmentRequest_MixedValidAndInvalidSku_RejectsBeforeStockMutation()
    {
        var stockRepo = new Mock<ISkuStockRepository>(MockBehavior.Strict);
        var request = InventoryWorkflowTestBuilders.PendingShelfReplenishmentRequest();
        request.Items.Add(new StockAdjustmentRequestItem
        {
            Id = Guid.NewGuid(), RequestId = request.Id, SkuId = Guid.NewGuid(), SkuCode = "RM-TEST",
            SkuSnapshotName = "Nguyên liệu test", QuantityDelta = 1
        });
        var validSku = request.Items[0].SkuId;
        var invalidSku = request.Items[1].SkuId;
        var catalog = new ProductCatalogSnapshot([
            new CatalogProduct(Guid.NewGuid(), "Thành phẩm", "THANH_PHAM", "Piece", "Cái", true,
                [new CatalogVariant(validSku, Guid.NewGuid(), "TP-TEST", "TP test", true, true, false, 0, [])]),
            new CatalogProduct(Guid.NewGuid(), "Nguyên liệu", "NGUYEN_LIEU", "Piece", "Cái", true,
                [new CatalogVariant(invalidSku, Guid.NewGuid(), "RM-TEST", "RM test", true, false, false, 0, [])])
        ]);
        var logic = BuildLogic(request, catalog, stockRepo.Object);

        await Assert.ThrowsAsync<InventoryValidationException>(
            () => logic.ReviewStockAdjustmentRequestAsync(request.Id, Guid.NewGuid(), null));

        stockRepo.VerifyNoOtherCalls();
    }

    private static InventoryLogic BuildLogic(
        StockAdjustmentRequest request,
        ProductCatalogSnapshot catalog,
        ISkuStockRepository stockRepo)
    {
        var adjustmentRepo = new Mock<IStockAdjustmentRequestRepository>();
        adjustmentRepo.Setup(repo => repo.GetByIdAsync(request.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(request);
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog.Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalog);

        return new InventoryLogic(
            stockRepo, Mock.Of<IStockDeductQueueRepository>(), adjustmentRepo.Object,
            Mock.Of<IStockExportSlipRepository>(), Mock.Of<IStockImportSlipRepository>(),
            Mock.Of<IWarehouseBatchRepository>(), Mock.Of<IStockExportBatchAllocationRepository>(),
            Mock.Of<IInventoryLedgerRepository>(), Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(), Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            Mock.Of<IProcessedIntegrationEventRepository>(),
            Mock.Of<IInventoryEventPublisher>(), Mock.Of<IInventoryUnitOfWork>(),
            Mock.Of<IProductionOrderRepository>(), Mock.Of<IStockTransferRepository>(), productCatalog.Object, Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            Mock.Of<HuongVanTra.Shared.Notifications.INotificationClient>(),
            Microsoft.Extensions.Options.Options.Create(new InventoryOptions()));
    }
}
