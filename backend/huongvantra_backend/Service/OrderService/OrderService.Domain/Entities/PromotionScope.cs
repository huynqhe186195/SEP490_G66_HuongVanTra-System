using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class PromotionScope : BaseEntity
{
    public Guid Id { get; set; }
    public Guid PromotionId { get; set; }
    public PromotionScopeType ScopeType { get; set; }
    public Guid? SkuId { get; set; }
    public string? SkuCode { get; set; }
    public string? SkuSnapshotName { get; set; }
    public int? CategoryId { get; set; }
    public string? CategorySnapshotName { get; set; }

    public Promotion Promotion { get; set; } = null!;
}
