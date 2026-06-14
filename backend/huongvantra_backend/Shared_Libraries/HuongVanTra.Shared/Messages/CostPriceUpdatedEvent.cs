namespace HuongVanTra.Shared.Messages;

public record CostPriceUpdatedEvent
{
    public Guid SkuId { get; init; }
    public decimal NewCostPrice { get; init; }
}
