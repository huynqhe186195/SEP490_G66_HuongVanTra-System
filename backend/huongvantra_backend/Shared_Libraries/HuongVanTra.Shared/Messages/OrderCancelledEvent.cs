namespace HuongVanTra.Shared.Messages;

public record OrderCancelledEvent
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
