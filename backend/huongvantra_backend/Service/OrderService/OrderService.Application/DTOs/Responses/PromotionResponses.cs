namespace OrderService.Application.DTOs.Responses;

public record PromotionScopeResponse(
    Guid SkuId,
    string? SkuCode,
    string? SkuName
);

public record PromotionResponse(
    Guid Id,
    string PromoCode,
    string DiscountType,
    decimal DiscountValue,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    string ValidityStatus,
    bool IsActive,
    string ScopeType,
    List<PromotionScopeResponse> SkuScopes,
    int OrderCount
);

public record PromotionLookupResponse(
    Guid Id,
    string PromoCode,
    string DiscountType,
    decimal DiscountValue,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    string ValidityStatus,
    bool IsActive,
    string ScopeType,
    List<PromotionScopeResponse> SkuScopes
);

public record PromotionApplyPreviewResponse(
    Guid Id,
    string PromoCode,
    string DiscountType,
    decimal DiscountValue,
    string ScopeType,
    List<PromotionScopeResponse> SkuScopes,
    decimal PromotionDiscountAmount,
    decimal EligibleSubtotal,
    string Message
);
