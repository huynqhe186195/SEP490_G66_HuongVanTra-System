namespace HuongVanTra.Shared.Messages;

/// <summary>
/// POS-04 (H5): đơn COD chuyển sang Shipping / bàn giao cho giao hàng.
/// Đây là trigger duy nhất trừ tồn vật lý Kệ Hàng cho đơn COD đã giữ chỗ:
/// Inventory tiêu thụ reservation và trừ QuantityOnHand đúng một lần (idempotent theo EventId
/// + business key). VerifyCod sau Shipping không được trừ lần hai.
/// </summary>
public record OrderShippedEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public string OrderChannel { get; init; } = string.Empty;
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
