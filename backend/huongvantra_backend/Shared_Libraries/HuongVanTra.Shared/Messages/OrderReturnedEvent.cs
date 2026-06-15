namespace HuongVanTra.Shared.Messages;

public record OrderReturnedEvent
{
    public Guid ReturnId { get; init; }
    public string ReturnCode { get; init; } = string.Empty;
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public Guid? CustomerId { get; init; }
    public decimal ReturnAmount { get; init; }
    public decimal OrderFinalAmount { get; init; }
    public decimal RefundAmount { get; init; }
    public IEnumerable<OrderItemEvent> Items { get; init; } = Enumerable.Empty<OrderItemEvent>();
}
