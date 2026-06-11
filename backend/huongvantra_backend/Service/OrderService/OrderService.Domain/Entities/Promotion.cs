using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class Promotion : BaseEntity
{
    public Guid Id { get; set; }
    public string PromoCode { get; set; } = string.Empty;
    public string NormalizedPromoCode { get; set; } = string.Empty;
    public PromotionDiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal MinimumOrderAmount { get; set; } = 0m;
    public int? UsageLimitTotal { get; set; }
    public int? UsageLimitPerCustomer { get; set; }
    public PromotionScopeType ScopeType { get; set; } = PromotionScopeType.ORDER;
    public DateTime? ValidFromUtc { get; set; }
    public DateTime? ValidToUtc { get; set; }
    public bool IsActive { get; set; }
    public ICollection<PromotionScope> Scopes { get; set; } = new List<PromotionScope>();
}
