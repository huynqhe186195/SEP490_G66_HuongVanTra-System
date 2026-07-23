namespace HuongVanTra.Shared.Messages;

public record OrderCancelledEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
