using HuongVanTra.Shared.Messages;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Messaging;

/// <summary>
/// Triển khai <see cref="IOrderEventPublisher"/> theo mô hình Transactional Outbox.
///
/// Thay vì publish trực tiếp lên RabbitMQ, mỗi phương thức sinh đúng một
/// <c>EventId</c>, gắn EventId đó vào payload rồi ghi payload vào Outbox thông qua
/// <see cref="IOrderOutboxWriter"/>. Writer chỉ Add entity vào OrderDbContext hiện tại
/// và KHÔNG tự SaveChanges, nên OutboxMessage được commit cùng transaction với
/// thay đổi nghiệp vụ (Order/Payment/Return) khi caller gọi SaveChangesAsync.
///
/// Nhờ đó:
/// - <c>OutboxMessage.Id == payload.EventId</c> (dùng làm khoá chống trùng ở Inbox).
/// - Không còn publish trực tiếp trong request path; một Dispatcher nền (G5) sẽ
///   đọc Outbox và publish lên broker sau khi transaction đã commit.
/// </summary>
public sealed class OutboxOrderEventPublisher(IOrderOutboxWriter _outbox) : IOrderEventPublisher
{
    public async Task PublishOrderPlacedAsync(
        Guid orderId, string orderCode, string orderStatus, string orderChannel, decimal totalAmount,
        IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)> items,
        CancellationToken ct = default)
    {
        var eventId = Guid.NewGuid();
        var message = new OrderPlacedEvent
        {
            EventId = eventId,
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            OrderStatus = orderStatus,
            OrderChannel = orderChannel,
            TotalAmount = totalAmount,
            Items = items.Select(i => new OrderItemEvent
            {
                SkuId = i.SkuId,
                SkuName = i.SkuName,
                SkuCode = i.SkuCode,
                Quantity = i.Quantity
            }).ToList()
        };

        await _outbox.EnqueueAsync(eventId, orderId, message, ct);
    }

    public async Task PublishOrderCancelledAsync(
        Guid orderId, string orderCode, string previousOrderStatus,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default)
    {
        var eventId = Guid.NewGuid();
        var message = new OrderCancelledEvent
        {
            EventId = eventId,
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            PreviousOrderStatus = previousOrderStatus,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity }).ToList()
        };

        await _outbox.EnqueueAsync(eventId, orderId, message, ct);
    }

    public async Task PublishOrderShippedAsync(
        Guid orderId, string orderCode, string orderChannel,
        IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)> items,
        CancellationToken ct = default)
    {
        var eventId = Guid.NewGuid();
        var message = new OrderShippedEvent
        {
            EventId = eventId,
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            OrderChannel = orderChannel,
            Items = items.Select(i => new OrderItemEvent
            {
                SkuId = i.SkuId,
                SkuName = i.SkuName,
                SkuCode = i.SkuCode,
                Quantity = i.Quantity
            }).ToList()
        };

        await _outbox.EnqueueAsync(eventId, orderId, message, ct);
    }

    public async Task PublishOrderCompletedAsync(
        Guid orderId, string orderCode, Guid customerId,
        decimal totalAmount, decimal debtAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        string? codDebtSettlementJson = null,
        CancellationToken ct = default)
    {
        var eventId = Guid.NewGuid();
        var message = new OrderCompletedEvent
        {
            EventId = eventId,
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = customerId,
            TotalAmount = totalAmount,
            DebtAmount = debtAmount,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity }).ToList(),
            CodDebtSettlementJson = codDebtSettlementJson
        };

        await _outbox.EnqueueAsync(eventId, orderId, message, ct);
    }

    public async Task PublishOrderReturnedAsync(
        Guid returnId,
        string returnCode,
        Guid orderId,
        string orderCode,
        Guid? customerId,
        decimal returnAmount,
        decimal orderFinalAmount,
        decimal refundAmount,
        IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)> items,
        CancellationToken ct = default)
    {
        var eventId = Guid.NewGuid();
        var message = new OrderReturnedEvent
        {
            EventId = eventId,
            OccurredAtUtc = DateTime.UtcNow,
            ReturnId = returnId,
            ReturnCode = returnCode,
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = customerId,
            ReturnAmount = returnAmount,
            OrderFinalAmount = orderFinalAmount,
            RefundAmount = refundAmount,
            Items = items.Select(i => new OrderItemEvent
            {
                SkuId = i.SkuId,
                SkuName = i.SkuName,
                SkuCode = i.SkuCode,
                Quantity = i.Quantity
            }).ToList()
        };

        // Return event dùng ReturnId làm aggregate để truy vết theo phiếu trả.
        await _outbox.EnqueueAsync(eventId, returnId, message, ct);
    }
}
