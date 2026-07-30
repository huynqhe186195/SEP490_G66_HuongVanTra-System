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

// Regression: editing a walk-in (customerId null) order with no gift line must succeed.
// The VIP gate in ApplyOrderDetailUpdatesAsync must only fire when the edit contains a
// gift line, mirroring the create path. Previously it fired unconditionally and blocked
// every walk-in edit (e.g. a plain COD quantity change) with the VIP-only error.
public class OrderUpdateWalkInGiftGateTests
{
    [Fact]
    public async Task WalkInEdit_NonGiftQuantityChange_SucceedsWithoutVipCustomer()
    {
        var harness = new Harness();
        var order = harness.SeedWalkInOrder(quantity: 5);

        var result = await harness.UpdateAsync(
            order.Id,
            harness.QuantityEditRequest(order, newQuantity: 8, isGift: false));

        Assert.Equal(8, order.OrderDetails.Single().Quantity);
        Assert.Equal(80_000, result.TotalAmount);
    }

    [Fact]
    public async Task WalkInEdit_GiftLine_IsRejectedWithVipMessage()
    {
        var harness = new Harness();
        var order = harness.SeedWalkInOrder(quantity: 5);

        var exception = await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.UpdateAsync(
                order.Id,
                harness.QuantityEditRequest(order, newQuantity: 5, isGift: true)));

        Assert.Contains("VIP", exception.Message);
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
        private readonly Mock<IOrderRepository> _orderRepository = new();
        private readonly OrderLogic _logic;

        public Harness()
        {
            var productCatalog = new Mock<IProductCatalogClient>();
            productCatalog
                .Setup(client => client.GetSkuProfilesAsync(
                    It.IsAny<IEnumerable<Guid>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ProductSkuCatalogProfile(SkuId, null, "Piece")]);

            _orderRepository
                .Setup(repository => repository.SaveChangesAsync(
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);
            _activityRepository
                .Setup(repository => repository.AddAsync(
                    It.IsAny<OrderActivity>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _paymentRepository
                .Setup(repository => repository.GetByOrderIdAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            var promotionLogic = new PromotionLogic(
                _promotionRepository.Object,
                _customerCatalog.Object);
            var shiftGuard = PosShiftTestDoubles.ShiftGuard();
            var posCashSessionLogic = PosShiftTestDoubles.CashSessionLogic(shiftGuard);
            _logic = new OrderLogic(
                _orderRepository.Object,
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

        public Order SeedWalkInOrder(int quantity)
        {
            var order = new Order
            {
                Id = Guid.NewGuid(),
                OrderCode = "WALKIN-EDIT-TEST",
                CustomerId = null,
                EmployeeId = _actorId,
                OrderChannel = OrderChannel.POS,
                OrderStatus = OrderStatus.PendingPayment,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                OrderDetails =
                [
                    new OrderDetail
                    {
                        Id = Guid.NewGuid(),
                        SkuId = SkuId,
                        SkuSnapshotName = "Test SKU",
                        SkuSnapshotCode = "TEST-SKU",
                        Quantity = quantity,
                        CostPrice = 0,
                        UnitPrice = 10_000,
                        SubTotal = quantity * 10_000,
                        IsGift = false,
                    }
                ],
            };
            order.TotalAmount = order.OrderDetails.Sum(detail => detail.SubTotal);
            _orderRepository
                .Setup(repository => repository.GetByIdAsync(
                    order.Id,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(order);
            return order;
        }

        public UpdateOrderRequest QuantityEditRequest(Order order, int newQuantity, bool isGift)
        {
            var detail = order.OrderDetails.Single();
            return new UpdateOrderRequest(
                ShippingAddress: null,
                Note: null,
                DiscountAmount: 0,
                Items:
                [
                    new UpdateOrderDetailRequest(
                        Id: detail.Id,
                        SkuId: detail.SkuId,
                        SkuSnapshotName: detail.SkuSnapshotName,
                        SkuSnapshotCode: detail.SkuSnapshotCode,
                        CategorySnapshotName: null,
                        Quantity: newQuantity,
                        CostPrice: 0,
                        UnitPrice: 10_000,
                        IsGift: isGift)
                ]);
        }

        public Task<OrderResponse> UpdateAsync(Guid orderId, UpdateOrderRequest request) =>
            _logic.UpdateAsync(
                orderId,
                request,
                new OrderAccessContext(
                    _actorId,
                    CanViewAllOrders: true,
                    CanViewOwnOrders: true),
                _actorId,
                "Sale POS");
    }
}
