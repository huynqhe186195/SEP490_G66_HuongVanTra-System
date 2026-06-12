namespace OrderService.Application.DTOs.Requests;

public class GetAdminPromotionsRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Search { get; set; }
    public string? DiscountType { get; set; }
    public string? ScopeType { get; set; }
    public string? Status { get; set; }
}

public class CreatePromotionRequest
{
    public string? PromoCode { get; init; }
    public string? DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal? MinimumOrderAmount { get; init; }
    public int? UsageLimitTotal { get; init; }
    public int? UsageLimitPerCustomer { get; init; }
    public DateTime? ValidFrom { get; init; }
    public DateTime? ValidTo { get; init; }
    public DateTime? ValidFromUtc { get; init; }
    public DateTime? ValidToUtc { get; init; }
    public bool? IsActive { get; init; }
    public string? ScopeType { get; init; }
    public List<Guid>? SkuIds { get; init; }
    public List<PromotionSkuScopeRequest>? SkuScopes { get; init; }
    public List<int>? CategoryIds { get; init; }
    public List<PromotionCategoryScopeRequest>? CategoryScopes { get; init; }
}

public class UpdatePromotionRequest
{
    public string? PromoCode { get; init; }
    public string? DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal? MinimumOrderAmount { get; init; }
    public int? UsageLimitTotal { get; init; }
    public int? UsageLimitPerCustomer { get; init; }
    public DateTime? ValidFrom { get; init; }
    public DateTime? ValidTo { get; init; }
    public DateTime? ValidFromUtc { get; init; }
    public DateTime? ValidToUtc { get; init; }
    public bool? IsActive { get; init; }
    public string? ScopeType { get; init; }
    public List<Guid>? SkuIds { get; init; }
    public List<PromotionSkuScopeRequest>? SkuScopes { get; init; }
    public List<int>? CategoryIds { get; init; }
    public List<PromotionCategoryScopeRequest>? CategoryScopes { get; init; }
}

public record PromotionSkuScopeRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuName
);

public record PromotionCategoryScopeRequest(
    int CategoryId,
    string? CategoryName
);

public record PromotionApplyPreviewRequest(
    Guid? PromotionId,
    string? PromotionCode,
    Guid? CustomerId,
    decimal ManualDiscount,
    List<PromotionApplyPreviewItemRequest> Items
);

public record PromotionApplyPreviewItemRequest(
    Guid SkuId,
    int Quantity,
    decimal UnitPrice,
    decimal? SubTotal,
    int? CategoryId = null
);
