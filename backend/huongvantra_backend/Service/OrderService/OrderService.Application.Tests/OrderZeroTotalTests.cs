using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Application.Tests.TestSupport;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderZeroTotalTests
{
    [Fact]
    public async Task GuestZeroTotalWithoutPromotion_IsRejectedWithoutSideEffects()
    {
        var harness = new Harness();

        await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(unitPrice: 0)));

        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task NormalCustomerZeroTotalWithoutPromotion_IsRejectedWithoutSideEffects()
    {
        var customerId = Guid.NewGuid();
        var harness = new Harness();
        harness.Customer(customerId, "CaNhan");

        await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(customerId, unitPrice: 0)));

        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task TierNonVipZeroTotalWithoutPromotion_IsRejectedWithoutSideEffects()
    {
        var customerId = Guid.NewGuid();
        var harness = new Harness();
        harness.Customer(customerId, "CaNhan", tierId: 2, tierDiscountPercent: 100);

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(customerId)));

        Assert.Contains("khuyến mãi hợp lệ", exception.Message);
        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task VipManualDiscountOnlyZeroTotal_IsRejectedWithoutSideEffects()
    {
        var customerId = Guid.NewGuid();
        var harness = new Harness();
        harness.Customer(customerId, "DoiNgoai");

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(customerId, manualDiscount: 10_000)));

        Assert.Contains("Chiết khấu thủ công", exception.Message);
        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task DirectApiNonGiftZeroUnitPrice_IsRejectedWithoutSideEffects()
    {
        var harness = new Harness();

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(unitPrice: 0, isGift: false)));

        Assert.Contains("đơn giá lớn hơn 0", exception.Message);
        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task BackendValidatedFullPromotion_AllowsZeroTotalOrder()
    {
        var harness = new Harness();
        var promotionId = harness.FullPromotion(10_000);

        var result = await harness.CreateAsync(harness.Request(promotionId: promotionId));

        Assert.Equal(0, result.FinalAmount);
        harness.OrderRepository.Verify(
            repository => repository.AddAsync(
                It.Is<Order>(order =>
                    order.FinalAmount == 0
                    && order.PromotionId == promotionId),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task BackendVerifiedVipGift_AllowsZeroTotalOrder()
    {
        var customerId = Guid.NewGuid();
        var harness = new Harness();
        harness.Customer(customerId, "DoiNgoai");

        var result = await harness.CreateAsync(
            harness.Request(customerId, unitPrice: 10_000, isGift: true));

        Assert.Equal(0, result.FinalAmount);
        harness.OrderRepository.Verify(
            repository => repository.AddAsync(
                It.Is<Order>(order =>
                    order.FinalAmount == 0
                    && order.OrderDetails.All(detail => detail.IsGift && detail.UnitPrice == 0)),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private sealed class Harness
    {
        private static readonly Guid SkuId =
            Guid.Parse("bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb");
        private readonly Guid _actorId = Guid.NewGuid();
        private readonly Mock<ICustomerCatalogClient> _customerCatalog = new();
        private readonly Mock<IPromotionRepository> _promotionRepository = new();
        private readonly Mock<IOrderCodeGenerator> _codeGenerator = new();
        private readonly Mock<IOrderEventPublisher> _eventPublisher = new();
        private readonly Mock<IOrderActivityRepository> _activityRepository = new();
        private readonly Mock<IInventoryCatalogClient> _inventoryCatalog = new();
        private readonly Mock<IPaymentRepository> _paymentRepository = new();
        private readonly Mock<IReturnOrderRepository> _returnOrderRepository = new();

        public Harness()
        {
            var productCatalog = new Mock<IProductCatalogClient>();
            productCatalog
                .Setup(client => client.GetSkuProfilesAsync(
                    It.IsAny<IEnumerable<Guid>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ProductSkuCatalogProfile(SkuId, null, "Piece", "THANH_PHAM", true, false, false, true, 0m)]);

            _codeGenerator
                .Setup(generator => generator.GenerateAsync(
                    It.IsAny<OrderKind>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync("ZERO-TOTAL-TEST");
            OrderRepository
                .Setup(repository => repository.AddAsync(
                    It.IsAny<Order>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            OrderRepository
                .Setup(repository => repository.SaveChangesAsync(
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);
            _activityRepository
                .Setup(repository => repository.AddAsync(
                    It.IsAny<OrderActivity>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _inventoryCatalog
                .Setup(client => client.PreparePosStockDeductionAsync(
                    It.IsAny<InventoryStockHandlingRequest>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                    new InventoryStockHandlingResponse(
                        request.OrderId,
                        request.OrderCode,
                        "FinishedGoods",
                        false,
                        "Stock handled",
                        [],
                        []));
            _promotionRepository
                .Setup(repository => repository.CountOrdersUsingPromotionAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(0);

            var promotionLogic = new PromotionLogic(
                _promotionRepository.Object,
                _customerCatalog.Object);
            var shiftGuard = PosShiftTestDoubles.ShiftGuard();
            var posCashSessionLogic = PosShiftTestDoubles.CashSessionLogic(shiftGuard);
            Logic = new OrderLogic(
                OrderRepository.Object,
                _returnOrderRepository.Object,
                _paymentRepository.Object,
                _codeGenerator.Object,
                _eventPublisher.Object,
                _activityRepository.Object,
                promotionLogic,
                productCatalog.Object,
                _customerCatalog.Object,
                new Mock<IContractCatalogClient>().Object,
                _inventoryCatalog.Object,
                new Mock<ICustomBundleRepository>().Object,
                new Mock<IEmailService>().Object,
                posCashSessionLogic,
                shiftGuard,
                Microsoft.Extensions.Options.Options.Create(new SepayOptions()));
        }

        public Mock<IOrderRepository> OrderRepository { get; } = new();
        private OrderLogic Logic { get; }

        public void Customer(
            Guid customerId,
            string customerGroup,
            int? tierId = null,
            decimal tierDiscountPercent = 0) =>
            _customerCatalog
                .Setup(client => client.GetCustomerAsync(
                    customerId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CustomerCatalogProfile(
                    customerId,
                    "Test Customer",
                    null,
                    customerGroup,
                    tierId,
                    tierId.HasValue ? "Tier" : null,
                    tierDiscountPercent));

        public Guid FullPromotion(decimal amount)
        {
            var promotionId = Guid.NewGuid();
            _promotionRepository
                .Setup(repository => repository.GetByIdAsync(
                    promotionId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Promotion
                {
                    Id = promotionId,
                    PromoCode = "FULL100",
                    NormalizedPromoCode = "FULL100",
                    DiscountType = PromotionDiscountType.FIXED,
                    DiscountValue = amount,
                    MinimumOrderAmount = amount,
                    ScopeType = PromotionScopeType.ORDER,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            return promotionId;
        }

        public CreateOrderRequest Request(
            Guid? customerId = null,
            decimal unitPrice = 10_000,
            bool isGift = false,
            decimal manualDiscount = 0,
            Guid? promotionId = null) =>
            new(
                CustomerId: customerId,
                CustomerSnapshotName: customerId.HasValue ? "Test Customer" : "Guest",
                EmployeeId: null,
                OrderChannel: OrderChannel.POS,
                ShippingAddress: null,
                Note: "zero-total hotfix regression",
                DiscountAmount: manualDiscount,
                Items:
                [
                    new CreateOrderDetailRequest(
                        SkuId,
                        "Test SKU",
                        "TEST-SKU",
                        null,
                        Quantity: 1,
                        CostPrice: 0,
                        UnitPrice: unitPrice,
                        IsGift: isGift)
                ],
                PaymentMethod: PaymentMethod.Cash,
                PaidAmount: 0,
                PromotionId: promotionId);

        public Task<OrderResponse> CreateAsync(CreateOrderRequest request) =>
            Logic.CreateAsync(
                request,
                new OrderAccessContext(
                    _actorId,
                    CanViewAllOrders: false,
                    CanViewOwnOrders: true),
                _actorId,
                "Sale POS");

        public void VerifyNoSideEffects()
        {
            _codeGenerator.Verify(
                generator => generator.GenerateAsync(
                    It.IsAny<OrderKind>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);
            OrderRepository.Verify(
                repository => repository.AddAsync(
                    It.IsAny<Order>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);
            OrderRepository.Verify(
                repository => repository.SaveChangesAsync(
                    It.IsAny<CancellationToken>()),
                Times.Never);
            _activityRepository.VerifyNoOtherCalls();
            _inventoryCatalog.VerifyNoOtherCalls();
            _eventPublisher.VerifyNoOtherCalls();
            _paymentRepository.VerifyNoOtherCalls();
            _returnOrderRepository.VerifyNoOtherCalls();
        }
    }
}
