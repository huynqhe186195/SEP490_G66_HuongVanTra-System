namespace HuongVanTra.Shared.Messages;

public record LowStockEvent
{
    public Guid SkuId { get; init; }
    public string SkuCode { get; init; } = string.Empty;
    public int CurrentStock { get; init; }
    public int Threshold { get; init; }
    public DateTime OccurredAt { get; init; }
}
