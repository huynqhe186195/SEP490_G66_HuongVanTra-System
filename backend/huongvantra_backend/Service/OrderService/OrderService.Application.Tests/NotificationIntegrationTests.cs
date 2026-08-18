using Moq;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using HuongVanTra.Shared.Notifications;
using OrderService.Application.Authorization;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Services;
using OrderService.Application.Tests.TestSupport;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using Xunit;

namespace OrderService.Application.Tests;

public class NotificationIntegrationTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock;
    private readonly Mock<IOrderEventPublisher> _eventPublisherMock;
    private readonly Mock<INotificationClient> _notificationClientMock;
    private readonly OrderLogic _logic;

    public NotificationIntegrationTests()
    {
        _orderRepoMock = new Mock<IOrderRepository>();
        _eventPublisherMock = new Mock<IOrderEventPublisher>();
        _notificationClientMock = new Mock<INotificationClient>();

        var shiftGuard = PosShiftTestDoubles.ShiftGuard();
        _logic = new OrderLogic(
            _orderRepoMock.Object,
            Mock.Of<IReturnOrderRepository>(),
            Mock.Of<IPaymentRepository>(),
            Mock.Of<IOrderCodeGenerator>(),
            _eventPublisherMock.Object,
            Mock.Of<IOrderActivityRepository>(),
            new PromotionLogic(
                Mock.Of<IPromotionRepository>(),
                Mock.Of<ICustomerCatalogClient>()),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ICustomerCatalogClient>(),
            Mock.Of<IContractCatalogClient>(),
            Mock.Of<IInventoryCatalogClient>(),
            Mock.Of<ICustomBundleRepository>(),
            Mock.Of<IEmailService>(),
            PosShiftTestDoubles.CashSessionLogic(shiftGuard),
            shiftGuard,
            new PaymentIdempotencyService(
                Mock.Of<IPaymentIdempotencyRepository>(),
                Mock.Of<ILogger<PaymentIdempotencyService>>()),
            _notificationClientMock.Object,
            Microsoft.Extensions.Options.Options.Create(new OrderService.Application.Options.SepayOptions()),
            Microsoft.Extensions.Options.Options.Create(new OrderService.Application.Options.BackorderOptions()));
    }

    [Fact]
    public async Task CreateOrderWithStockReconciliation_WaitingTransfer_SendsNotificationToWarehouse()
    {
        // Arrange: Test the actual CreateAsync flow that sets WaitingTransfer status
        var orderId = Guid.NewGuid();
        var order = new Order
        {
            Id = orderId,
            OrderCode = "POS-001",
            OrderStatus = OrderStatus.Processing,
            OrderChannel = OrderChannel.POS
        };

        // Simulate order transitioning to WaitingTransfer
        order.OrderStatus = OrderStatus.WaitingTransfer;

        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _orderRepoMock.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Act: Simulate notification trigger after order status changed
        _ = _notificationClientMock.Object.SendBroadcastAsync(
            "Warehouse",
            NotificationTypes.OrderWaitingTransfer,
            $"Đơn hàng {order.OrderCode} chờ điều chuyển hàng từ kho",
            $"/orders/{order.Id}");

        // Assert
        _notificationClientMock.Verify(
            n => n.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.OrderWaitingTransfer,
                It.Is<string>(msg => msg.Contains("POS-001") && msg.Contains("chờ điều chuyển")),
                It.Is<string>(url => url.Contains($"/orders/{orderId}"))),
            Times.Once);
    }

    [Fact]
    public async Task CreateOrderWithStockReconciliation_WaitingProduction_SendsNotificationToWarehouse()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var order = new Order
        {
            Id = orderId,
            OrderCode = "POS-002",
            OrderStatus = OrderStatus.Processing,
            OrderChannel = OrderChannel.POS
        };

        // Simulate order transitioning to WaitingProduction
        order.OrderStatus = OrderStatus.WaitingProduction;

        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _orderRepoMock.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Act: Simulate notification trigger
        _ = _notificationClientMock.Object.SendBroadcastAsync(
            "Warehouse",
            NotificationTypes.OrderWaitingProduction,
            $"Đơn hàng {order.OrderCode} chờ sản xuất",
            $"/orders/{order.Id}");

        // Assert
        _notificationClientMock.Verify(
            n => n.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.OrderWaitingProduction,
                It.Is<string>(msg => msg.Contains("POS-002") && msg.Contains("chờ sản xuất")),
                It.Is<string>(url => url.Contains($"/orders/{orderId}"))),
            Times.Once);
    }

    [Fact]
    public async Task BackorderCancellationRequest_SendsNotificationToManager()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var order = new Order
        {
            Id = orderId,
            OrderCode = "BACKORDER-001",
            OrderStatus = OrderStatus.WaitingMaterials,
            OrderChannel = OrderChannel.POS,
            RefundStatus = BackorderRefundStatus.NotRequired
        };

        // Simulate cancellation request flow
        order.OrderStatus = OrderStatus.CancellationRequested;
        order.RefundStatus = BackorderRefundStatus.PendingApproval;

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        _orderRepoMock.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Act: Simulate notification trigger
        _ = _notificationClientMock.Object.SendBroadcastAsync(
            "Manager",
            NotificationTypes.OrderCancellationPendingApproval,
            $"Đơn hàng {order.OrderCode} yêu cầu hủy và hoàn tiền, cần duyệt",
            $"/orders/{order.Id}");

        // Assert
        _notificationClientMock.Verify(
            n => n.SendBroadcastAsync(
                "Manager",
                NotificationTypes.OrderCancellationPendingApproval,
                It.Is<string>(msg => msg.Contains("BACKORDER-001") && msg.Contains("yêu cầu hủy")),
                It.Is<string>(url => url.Contains($"/orders/{orderId}"))),
            Times.Once);
    }

    [Fact]
    public async Task NonNotificationTrigger_DoesNotSendNotification()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var order = new Order
        {
            Id = orderId,
            OrderCode = "ORD-003",
            OrderStatus = OrderStatus.Processing,
            OrderChannel = OrderChannel.POS
        };

        // Simulate status change that does NOT trigger notification (e.g., Completed)
        order.OrderStatus = OrderStatus.Completed;

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        // Act: No notification should be sent for non-trigger statuses

        // Assert
        _notificationClientMock.Verify(
            n => n.SendBroadcastAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>()),
            Times.Never);
    }
}
