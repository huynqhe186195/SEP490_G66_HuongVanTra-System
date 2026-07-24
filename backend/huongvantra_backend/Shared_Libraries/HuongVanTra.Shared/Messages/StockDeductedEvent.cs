namespace HuongVanTra.Shared.Messages;

public record StockDeductedEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public bool Success { get; init; }
    public string? Status { get; init; }
    public string? Reason { get; init; }
}
