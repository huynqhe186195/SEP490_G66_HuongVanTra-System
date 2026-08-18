using Microsoft.Extensions.Options;
using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Services;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Application.Tests.TestSupport;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderUnavailableSkuTests
{
    public static TheoryData<string> UnavailableSkuCases => new()
    {
        "inactive SKU",
        "non-sellable SKU",
        "SKU under inactive Product",
    };

    [Theory]
    [MemberData(nameof(UnavailableSkuCases))]
    public async Task CreateOrder_RejectsUnavailableSkuWithoutPersistenceOrStockEvent(string _)
    {
        var skuId = Guid.NewGuid();
        var orderRepo = new Mock<IOrderRepository>();
        var eventPublisher = new Mock<IOrderEventPublisher>();
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog
            .Setup(client => client.GetSkuProfilesAsync(
                It.Is<IEnumerable<Guid>>(ids => ids.SequenceEqual(new[] { skuId })),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<ProductSkuCatalogProfile>());

        var customerCatalog = new Mock<ICustomerCatalogClient>();
        var promotionLogic = new PromotionLogic(
            new Mock<IPromotionRepository>().Object,
            customerCatalog.Object);
        var shiftGuard = PosShiftTestDoubles.ShiftGuard();
        var posCashSessionLogic = PosShiftTestDoubles.CashSessionLogic(shiftGuard);
        var logic = new OrderLogic(
            orderRepo.Object,
            new Mock<IReturnOrderRepository>().Object,
            new Mock<IPaymentRepository>().Object,
            new Mock<IOrderCodeGenerator>().Object,
            eventPublisher.Object,
            new Mock<IOrderActivityRepository>().Object,
            promotionLogic,
            productCatalog.Object,
            customerCatalog.Object,
            new Mock<IContractCatalogClient>().Object,
            new Mock<IInventoryCatalogClient>().Object,
            new Mock<ICustomBundleRepository>().Object,
            new Mock<IEmailService>().Object,
            posCashSessionLogic,
            shiftGuard,
            new PaymentIdempotencyService(
                Mock.Of<IPaymentIdempotencyRepository>(),
                Mock.Of<Microsoft.Extensions.Logging.ILogger<PaymentIdempotencyService>>()),
            new Mock<HuongVanTra.Shared.Notifications.INotificationClient>().Object,
            Microsoft.Extensions.Options.Options.Create(new SepayOptions()));

        var request = new CreateOrderRequest(
            CustomerId: null,
            CustomerSnapshotName: "Guest",
            EmployeeId: Guid.NewGuid(),
            OrderChannel: OrderChannel.POS,
            ShippingAddress: null,
            Note: "unavailable SKU regression",
            DiscountAmount: 0,
            Items:
            [
                new CreateOrderDetailRequest(
                    skuId,
                    "Unavailable SKU",
                    "UNAVAILABLE",
                    null,
                    Quantity: 1,
                    CostPrice: 0,
                    UnitPrice: 10_000)
            ],
            PaymentMethod: PaymentMethod.Cash,
            PaidAmount: 10_000);

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => logic.CreateAsync(
                request,
                new OrderAccessContext(Guid.NewGuid(), CanViewAllOrders: true)));

        Assert.Contains("tải lại danh mục", exception.Message);
        orderRepo.Verify(
            repo => repo.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
            Times.Never);
        orderRepo.Verify(
            repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Never);
        eventPublisher.VerifyNoOtherCalls();
    }
}
