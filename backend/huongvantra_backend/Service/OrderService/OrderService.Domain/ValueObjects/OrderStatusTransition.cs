using OrderService.Domain.Enums;

namespace OrderService.Domain.ValueObjects;

/// <summary>
/// State machine rules cho order status transitions.
/// Ngăn chặn các chuyển trạng thái không hợp lệ (EX-08).
/// </summary>
public static class OrderStatusTransition
{
    private static readonly Dictionary<OrderStatus, HashSet<OrderStatus>> ValidTransitions = new()
    {
        [OrderStatus.Draft] = new()
        {
            OrderStatus.PendingPayment,
            OrderStatus.Processing,
            OrderStatus.Cancelled
        },
        [OrderStatus.PendingPayment] = new()
        {
            OrderStatus.Processing,
            OrderStatus.Shipping,
            OrderStatus.WaitingMaterials,
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.Processing] = new()
        {
            OrderStatus.Shipping,
            OrderStatus.WaitingTransfer,
            OrderStatus.WaitingProduction,
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.Shipping] = new()
        {
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.WaitingMaterials] = new()
        {
            OrderStatus.WaitingProduction,
            OrderStatus.ReadyToDeliver,
            OrderStatus.CancellationRequested,
            OrderStatus.Cancelled
        },
        [OrderStatus.WaitingTransfer] = new()
        {
            OrderStatus.ReadyToDeliver,
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.WaitingProduction] = new()
        {
            OrderStatus.ReadyToDeliver,
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.ReadyToDeliver] = new()
        {
            OrderStatus.Completed,
            OrderStatus.Cancelled
        },
        [OrderStatus.CancellationRequested] = new()
        {
            OrderStatus.Cancelled
        },
        // Terminal states — không chuyển được nữa
        [OrderStatus.Completed] = new(),
        [OrderStatus.Cancelled] = new()
    };

    /// <summary>
    /// Kiểm tra xem có thể chuyển từ currentStatus sang newStatus không.
    /// </summary>
    public static bool IsValidTransition(OrderStatus currentStatus, OrderStatus newStatus)
    {
        if (!ValidTransitions.TryGetValue(currentStatus, out var allowedTargets))
            return false;

        return allowedTargets.Contains(newStatus);
    }

    /// <summary>
    /// Validate transition, throw exception nếu không hợp lệ.
    /// </summary>
    public static void EnsureValidTransition(OrderStatus currentStatus, OrderStatus newStatus, Guid orderId)
    {
        if (!IsValidTransition(currentStatus, newStatus))
        {
            throw new InvalidOrderStatusTransitionException(orderId, currentStatus, newStatus);
        }
    }

    /// <summary>
    /// Kiểm tra xem status có phải terminal state (không chuyển được nữa) không.
    /// </summary>
    public static bool IsTerminalStatus(OrderStatus status) =>
        status is OrderStatus.Completed or OrderStatus.Cancelled;
}

public class InvalidOrderStatusTransitionException : Exception
{
    public Guid OrderId { get; }
    public OrderStatus CurrentStatus { get; }
    public OrderStatus AttemptedStatus { get; }

    public InvalidOrderStatusTransitionException(Guid orderId, OrderStatus currentStatus, OrderStatus attemptedStatus)
        : base($"Không thể chuyển đơn {orderId} từ {currentStatus} sang {attemptedStatus}. Chuyển trạng thái không hợp lệ.")
    {
        OrderId = orderId;
        CurrentStatus = currentStatus;
        AttemptedStatus = attemptedStatus;
    }
}
