namespace HuongVanTra.Shared.Messages;

public record OrderPlacedEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public string OrderStatus { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
