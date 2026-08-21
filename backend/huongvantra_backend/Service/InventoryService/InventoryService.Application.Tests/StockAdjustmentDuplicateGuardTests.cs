using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Domain.Exceptions;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// Chặn gửi trùng SKU khi yêu cầu bổ sung Kệ Hàng trước đó chưa xử lý xong.
/// </summary>
public sealed class StockAdjustmentDuplicateGuardTests
{
    private static readonly Guid SkuId = Guid.Parse("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa");

    [Fact]
    public async Task Create_SkuPendingInUntouchedRequest_BlocksHard()
    {
        var repo = BuildRepo(OpenLine(StockAdjustmentRequestItemStatus.Pending, 0, 0));
        var logic = BuildLogic(repo.Object);

        var ex = await Assert.ThrowsAsync<DuplicateStockAdjustmentRequestException>(
            () => logic.CreateStockAdjustmentRequestAsync(NewRequest(), Guid.NewGuid()));

        Assert.True(ex.Blocking);
        repo.Verify(r => r.AddWithGeneratedCodeAsync(
            It.IsAny<StockAdjustmentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_SkuAlreadyPartiallyFulfilled_BlocksUntilLineIsClosed()
    {
        var repo = BuildRepo(OpenLine(StockAdjustmentRequestItemStatus.WaitingForStock, 5, 2));
        var logic = BuildLogic(repo.Object);

        var ex = await Assert.ThrowsAsync<DuplicateStockAdjustmentRequestException>(
            () => logic.CreateStockAdjustmentRequestAsync(NewRequest(), Guid.NewGuid()));

        Assert.True(ex.Blocking);
        Assert.Single(ex.Duplicates);
    }

    [Fact]
    public async Task Create_AcknowledgeDoesNotBypassPartiallyFulfilledLine()
    {
        var repo = BuildRepo(OpenLine(StockAdjustmentRequestItemStatus.WaitingForStock, 5, 2));
        var logic = BuildLogic(repo.Object);

        var ex = await Assert.ThrowsAsync<DuplicateStockAdjustmentRequestException>(
            () => logic.CreateStockAdjustmentRequestAsync(
                NewRequest(acknowledgeDuplicates: true), Guid.NewGuid()));

        Assert.True(ex.Blocking);
        repo.Verify(r => r.AddWithGeneratedCodeAsync(
            It.IsAny<StockAdjustmentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>Acknowledge không được phép bỏ qua cảnh báo cứng.</summary>
    [Fact]
    public async Task Create_AcknowledgeDoesNotBypassHardBlock()
    {
        var repo = BuildRepo(OpenLine(StockAdjustmentRequestItemStatus.Pending, 0, 0));
        var logic = BuildLogic(repo.Object);

        var ex = await Assert.ThrowsAsync<DuplicateStockAdjustmentRequestException>(
            () => logic.CreateStockAdjustmentRequestAsync(
                NewRequest(acknowledgeDuplicates: true), Guid.NewGuid()));

        Assert.True(ex.Blocking);
    }

    [Fact]
    public async Task Create_NoOpenDuplicate_Proceeds()
    {
        var repo = BuildRepo();
        var logic = BuildLogic(repo.Object);

        await logic.CreateStockAdjustmentRequestAsync(NewRequest(), Guid.NewGuid());

        repo.Verify(r => r.AddWithGeneratedCodeAsync(
            It.IsAny<StockAdjustmentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    private static CreateStockAdjustmentRequest NewRequest(bool acknowledgeDuplicates = false) =>
        new("Bổ sung kệ", [new CreateStockAdjustmentRequestItem(SkuId, "TP-TEST", "TP test", 3)],
            acknowledgeDuplicates);

    private static StockAdjustmentRequestItem OpenLine(
        StockAdjustmentRequestItemStatus status, int approved, int fulfilled)
    {
        var requestId = Guid.NewGuid();
        return new StockAdjustmentRequestItem
        {
            Id = Guid.NewGuid(),
            RequestId = requestId,
            SkuId = SkuId,
            SkuCode = "TP-TEST",
            SkuSnapshotName = "TP test",
            QuantityDelta = 5,
            ApprovedQuantity = approved,
            FulfilledQuantity = fulfilled,
            Status = status,
            Request = new StockAdjustmentRequest
            {
                Id = requestId,
                RequestCode = "YC-20260101-0001",
                Status = StockAdjustmentRequestStatus.Pending,
                RequestedBy = Guid.NewGuid(),
                RequestedByName = "Nguyễn A",
                RequestedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            },
        };
    }

    private static Mock<IStockAdjustmentRequestRepository> BuildRepo(
        params StockAdjustmentRequestItem[] openLines)
    {
        var repo = new Mock<IStockAdjustmentRequestRepository>();
        repo.Setup(r => r.GetOpenItemsBySkuIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([.. openLines]);
        return repo;
    }

    private static InventoryLogic BuildLogic(IStockAdjustmentRequestRepository adjustmentRepo)
    {
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog.Setup(client => client.GetCatalogForVariantIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ProductCatalogSnapshot([
                new CatalogProduct(Guid.NewGuid(), "Thành phẩm", "THANH_PHAM", "Piece", "Cái", true,
                    [new CatalogVariant(SkuId, Guid.NewGuid(), "TP-TEST", "TP test", true, true, false, 0, [])])
            ]));

        return new InventoryLogic(
            Mock.Of<ISkuStockRepository>(), Mock.Of<IStockDeductQueueRepository>(), adjustmentRepo,
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
