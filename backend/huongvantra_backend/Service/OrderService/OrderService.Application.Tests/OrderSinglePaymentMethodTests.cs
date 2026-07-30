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

public class OrderSinglePaymentMethodTests
{
    [Fact]
    public async Task CashPlusBankTransfer_IsRejectedWithoutSideEffects()
    {
        var harness = new Harness();

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(
            [
                new CreatePaymentAllocationRequest(PaymentMethod.Cash, 6_000),
                new CreatePaymentAllocationRequest(PaymentMethod.BankTransfer, 4_000),
            ])));

        Assert.Contains("một phương thức thanh toán", exception.Message);
        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task DuplicateCashAllocations_AreRejectedWithoutSideEffects()
    {
        var harness = new Harness();

        await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.CreateAsync(harness.Request(
            [
                new CreatePaymentAllocationRequest(PaymentMethod.Cash, 5_000),
                new CreatePaymentAllocationRequest(PaymentMethod.Cash, 5_000),
            ])));

        harness.VerifyNoSideEffects();
    }

    [Fact]
    public async Task SingleCashAllocation_IsAccepted()
    {
        var harness = new Harness();

        var result = await harness.CreateAsync(harness.Request(
        [
            new CreatePaymentAllocationRequest(PaymentMethod.Cash, 10_000),
        ]));

        Assert.Equal(10_000, result.FinalAmount);
    }

    [Fact]
    public async Task SingleBankTransferAllocation_IsAccepted()
    {
        var harness = new Harness();

        var result = await harness.CreateAsync(harness.Request(
        [
            new CreatePaymentAllocationRequest(PaymentMethod.BankTransfer, 10_000),
        ]));

        Assert.Equal(10_000, result.FinalAmount);
    }

    private sealed class Harness
    {
        private static readonly Guid SkuId =
            Guid.Parse("cccccccc-3333-4333-8333-cccccccccccc");
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
                .ReturnsAsync([new ProductSkuCatalogProfile(SkuId, null, "Piece", "THANH_PHAM", true, false, false, true)]);

            _codeGenerator
                .Setup(generator => generator.GenerateAsync(
                    It.IsAny<OrderKind>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync("SINGLE-PAYMENT-TEST");
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
                _inventoryCatalog.Object,
                new Mock<ICustomBundleRepository>().Object,
                new Mock<IEmailService>().Object,
                posCashSessionLogic,
                shiftGuard,
                Microsoft.Extensions.Options.Options.Create(new SepayOptions()));
        }

        public Mock<IOrderRepository> OrderRepository { get; } = new();
        private OrderLogic Logic { get; }

        public CreateOrderRequest Request(List<CreatePaymentAllocationRequest> payments) =>
            new(
                CustomerId: null,
                CustomerSnapshotName: "Guest",
                EmployeeId: null,
                OrderChannel: OrderChannel.POS,
                ShippingAddress: null,
                Note: "single payment method regression",
                DiscountAmount: 0,
                Items:
                [
                    new CreateOrderDetailRequest(
                        SkuId,
                        "Test SKU",
                        "TEST-SKU",
                        null,
                        Quantity: 1,
                        CostPrice: 0,
                        UnitPrice: 10_000)
                ],
                PaymentMethod: payments[0].PaymentMethod,
                PaidAmount: payments[0].Amount,
                Payments: payments);

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
