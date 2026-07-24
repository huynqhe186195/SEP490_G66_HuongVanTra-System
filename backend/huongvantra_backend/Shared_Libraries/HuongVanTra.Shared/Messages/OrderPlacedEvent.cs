namespace HuongVanTra.Shared.Messages;

public record OrderPlacedEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public string OrderStatus { get; init; } = string.Empty;
    /// <summary>
    /// POS-04: kênh đơn (POS, Website, Zalo, Phone, COD). Inventory chỉ giữ chỗ tồn Kệ Hàng
    /// cho đơn COD chờ xác nhận; các kênh khác khi chưa thanh toán không tự giữ chỗ.
    /// Rỗng = contract cũ → coi như không phải COD (không giữ chỗ).
    /// </summary>
    public string OrderChannel { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
