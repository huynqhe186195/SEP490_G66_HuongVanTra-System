namespace HuongVanTra.Shared.Messages;

public record OrderCancelledEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    /// <summary>
    /// POS-04: trạng thái đơn ngay trước khi hủy. Hủy sau Shipping không được cộng trực tiếp
    /// tồn Kệ trở lại (xử lý qua Return Inspection — Phase J). Rỗng = contract cũ →
    /// giữ hành vi hiện tại (restore nếu đã trừ).
    /// </summary>
    public string PreviousOrderStatus { get; init; } = string.Empty;
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
