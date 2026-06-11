namespace OrderService.Application.DTOs.Requests;

public class CreatePromotionRequest
{
    public string? PromoCode { get; init; }
    public string? DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public DateTime? ValidFrom { get; init; }
    public DateTime? ValidTo { get; init; }
    public DateTime? ValidFromUtc { get; init; }
    public DateTime? ValidToUtc { get; init; }
    public bool? IsActive { get; init; }
    public string? ScopeType { get; init; }
    public List<Guid>? SkuIds { get; init; }
    public List<PromotionSkuScopeRequest>? SkuScopes { get; init; }
}

public class UpdatePromotionRequest
{
    public string? PromoCode { get; init; }
    public string? DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public DateTime? ValidFrom { get; init; }
    public DateTime? ValidTo { get; init; }
    public DateTime? ValidFromUtc { get; init; }
    public DateTime? ValidToUtc { get; init; }
    public bool? IsActive { get; init; }
    public string? ScopeType { get; init; }
    public List<Guid>? SkuIds { get; init; }
    public List<PromotionSkuScopeRequest>? SkuScopes { get; init; }
}

public record PromotionSkuScopeRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuName
);

public record PromotionApplyPreviewRequest(
    Guid? PromotionId,
    string? PromotionCode,
    decimal ManualDiscount,
    List<PromotionApplyPreviewItemRequest> Items
);

public record PromotionApplyPreviewItemRequest(
    Guid SkuId,
    int Quantity,
    decimal UnitPrice,
    decimal? SubTotal
);
