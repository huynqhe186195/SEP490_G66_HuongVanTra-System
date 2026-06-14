namespace OrderService.Domain.Entities;

public class PromotionCustomerTierScope : BaseEntity
{
    public Guid Id { get; set; }
    public Guid PromotionId { get; set; }
    public int TierId { get; set; }
    public string? TierSnapshotName { get; set; }

    public Promotion Promotion { get; set; } = null!;
}
