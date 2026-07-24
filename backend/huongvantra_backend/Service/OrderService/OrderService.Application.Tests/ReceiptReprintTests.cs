using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using Xunit;

namespace OrderService.Application.Tests;

public class ReceiptReprintTests
{
    [Fact]
    public async Task CompletedOrder_WritesExactlyOneAuditLog()
    {
        var harness = new Harness();

        var result = await harness.ReprintAsync("Khách yêu cầu bản in bổ sung");

        Assert.Equal(1, result.Log.ReprintNumber);
        Assert.Equal("Khách yêu cầu bản in bổ sung", result.Log.Reason);
        Assert.True(result.Receipt.IsReprint);
        Assert.Single(harness.SavedLogs);
    }

    [Fact]
    public async Task ReasonIsTrimmed()
    {
        var harness = new Harness();

        var result = await harness.ReprintAsync("   Máy in lỗi giấy   ");

        Assert.Equal("Máy in lỗi giấy", result.Log.Reason);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("    ")]
    public async Task EmptyReason_IsRejectedWithoutAuditLog(string? reason)
    {
        var harness = new Harness();

        await Assert.ThrowsAsync<OrderValidationException>(() => harness.ReprintAsync(reason));

        Assert.Empty(harness.SavedLogs);
    }

    [Theory]
    [InlineData(OrderStatus.Draft)]
    [InlineData(OrderStatus.PendingPayment)]
    [InlineData(OrderStatus.Processing)]
    [InlineData(OrderStatus.Shipping)]
    [InlineData(OrderStatus.Cancelled)]
    public async Task NonCompletedOrder_IsRejectedWithoutAuditLog(OrderStatus status)
    {
        var harness = new Harness(status);

        await Assert.ThrowsAsync<OrderValidationException>(
            () => harness.ReprintAsync("Lý do hợp lệ"));

        Assert.Empty(harness.SavedLogs);
    }

    [Fact]
    public async Task ReprintNumber_IncrementsSequentiallyPerOrder()
    {
        var harness = new Harness();

        var first = await harness.ReprintAsync("Lần 1");
        var second = await harness.ReprintAsync("Lần 2");
        var third = await harness.ReprintAsync("Lần 3");

        Assert.Equal(1, first.Log.ReprintNumber);
        Assert.Equal(2, second.Log.ReprintNumber);
        Assert.Equal(3, third.Log.ReprintNumber);
        Assert.Equal(3, harness.SavedLogs.Count);
    }

    [Fact]
    public async Task SameIdempotencyKey_DoesNotCreateSecondAuditLog()
    {
        var harness = new Harness();
        var key = Guid.NewGuid().ToString("D");

        var first = await harness.ReprintAsync("Chống double-submit", key);
        var second = await harness.ReprintAsync("Chống double-submit", key);

        Assert.Equal(first.Log.Id, second.Log.Id);
        Assert.Equal(1, second.Log.ReprintNumber);
        Assert.Single(harness.SavedLogs);
    }

    [Fact]
    public async Task OrderOwnedByAnotherSale_IsStillReprintable()
    {
        var harness = new Harness();
        harness.Order.EmployeeId = Guid.NewGuid();

        var result = await harness.ReprintAsync("Sale khác in hộ");

        Assert.Equal(1, result.Log.ReprintNumber);
    }

    [Fact]
    public async Task Reprint_DoesNotMutateOrderTotals()
    {
        var harness = new Harness();
        var before = (
            harness.Order.TotalAmount,
            harness.Order.DiscountAmount,
            harness.Order.PromotionDiscountAmount,
            harness.Order.FinalAmount,
            harness.Order.OrderStatus,
            harness.Order.InventorySyncStatus,
            harness.Order.Payments!.Count);

        await harness.ReprintAsync("Kiểm tra bất biến");

        Assert.Equal(before, (
            harness.Order.TotalAmount,
            harness.Order.DiscountAmount,
            harness.Order.PromotionDiscountAmount,
            harness.Order.FinalAmount,
            harness.Order.OrderStatus,
            harness.Order.InventorySyncStatus,
            harness.Order.Payments!.Count));
    }

    [Fact]
    public async Task History_ReturnsLogsForOrder()
    {
        var harness = new Harness();
        await harness.ReprintAsync("Lần 1");
        await harness.ReprintAsync("Lần 2");

        var history = await harness.GetHistoryAsync();

        Assert.Equal(2, history.Count);
        Assert.Equal([1, 2], history.Select(log => log.ReprintNumber).OrderBy(n => n));
    }

    [Fact]
    public async Task MissingOrder_ThrowsOrderNotFound()
    {
        var harness = new Harness();
        harness.OrderRepository
            .Setup(repo => repo.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order?)null);

        await Assert.ThrowsAsync<OrderNotFoundException>(
            () => harness.ReprintAsync("Đơn không tồn tại"));
    }

    private sealed class Harness
    {
        private readonly Guid _actorId = Guid.NewGuid();
        private readonly List<OrderReceiptPrintLog> _pending = [];

        public Harness(OrderStatus status = OrderStatus.Completed)
        {
            Order = BuildOrder(status);

            OrderRepository
                .Setup(repo => repo.GetByIdAsync(Order.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => Order);

            PrintLogRepository
                .Setup(repo => repo.AddAsync(
                    It.IsAny<OrderReceiptPrintLog>(),
                    It.IsAny<CancellationToken>()))
                .Callback((OrderReceiptPrintLog log, CancellationToken _) => _pending.Add(log))
                .Returns(Task.CompletedTask);

            PrintLogRepository
                .Setup(repo => repo.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(() =>
                {
                    SavedLogs.AddRange(_pending);
                    var count = _pending.Count;
                    _pending.Clear();
                    return count;
                });

            PrintLogRepository
                .Setup(repo => repo.GetByOrderIdAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((Guid orderId, CancellationToken _) =>
                    SavedLogs.Where(log => log.OrderId == orderId).ToList());

            PrintLogRepository
                .Setup(repo => repo.GetByIdempotencyKeyAsync(
                    It.IsAny<string>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((string key, CancellationToken _) =>
                    SavedLogs.FirstOrDefault(log => log.IdempotencyKey == key));

            PrintLogRepository
                .Setup(repo => repo.GetLastReprintNumberAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((Guid orderId, CancellationToken _) =>
                    SavedLogs.Where(log => log.OrderId == orderId)
                        .Select(log => log.ReprintNumber)
                        .DefaultIfEmpty(0)
                        .Max());

            Logic = new ReceiptReprintLogic(
                OrderRepository.Object,
                PrintLogRepository.Object);
        }

        public Order Order { get; }
        public List<OrderReceiptPrintLog> SavedLogs { get; } = [];
        public Mock<IOrderRepository> OrderRepository { get; } = new();
        public Mock<IOrderReceiptPrintLogRepository> PrintLogRepository { get; } = new();
        private ReceiptReprintLogic Logic { get; }

        public Task<DTOs.Responses.ReceiptReprintResponse> ReprintAsync(
            string? reason, string? idempotencyKey = null) =>
            Logic.ReprintAsync(
                Order.Id, reason, _actorId, "Sale POS", idempotencyKey, Access());

        public Task<List<DTOs.Responses.ReceiptReprintLogResponse>> GetHistoryAsync() =>
            Logic.GetHistoryAsync(Order.Id, Access());

        private OrderAccessContext Access() =>
            new(_actorId, CanViewAllOrders: false, CanViewOwnOrders: true);

        private static Order BuildOrder(OrderStatus status)
        {
            var orderId = Guid.NewGuid();
            return new Order
            {
                Id = orderId,
                OrderCode = "REPRINT-TEST-01",
                OrderStatus = status,
                OrderChannel = OrderChannel.POS,
                OrderKind = OrderKind.Sale,
                InventorySyncStatus = InventorySyncStatus.Synced,
                CustomerSnapshotName = "Khách lẻ",
                TotalAmount = 100_000,
                DiscountAmount = 5_000,
                PromotionDiscountAmount = 5_000,
                FinalAmount = 90_000,
                CreatedAt = DateTime.UtcNow,
                OrderDetails =
                [
                    new OrderDetail
                    {
                        Id = Guid.NewGuid(),
                        OrderId = orderId,
                        SkuId = Guid.NewGuid(),
                        SkuSnapshotName = "Trà sen",
                        SkuSnapshotCode = "TRA-SEN-01",
                        Quantity = 2,
                        UnitPrice = 50_000,
                        SubTotal = 100_000,
                    }
                ],
                Payments =
                [
                    new Payment
                    {
                        Id = Guid.NewGuid(),
                        OrderId = orderId,
                        PaymentMethod = PaymentMethod.Cash,
                        PaymentStatus = PaymentStatus.Success,
                        Amount = 90_000,
                    }
                ],
            };
        }
    }
}
