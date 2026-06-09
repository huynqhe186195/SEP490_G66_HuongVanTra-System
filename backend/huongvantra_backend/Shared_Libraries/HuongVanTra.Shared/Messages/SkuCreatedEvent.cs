namespace HuongVanTra.Shared.Messages;

public record SkuCreatedEvent
{
    public Guid SkuId { get; init; }
    public string SkuCode { get; init; } = string.Empty;
    public int WeightInGrams { get; init; }
}
