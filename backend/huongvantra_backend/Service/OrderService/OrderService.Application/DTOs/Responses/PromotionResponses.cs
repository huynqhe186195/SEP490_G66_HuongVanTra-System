namespace OrderService.Application.DTOs.Responses;

public record PromotionResponse(
    Guid Id,
    string PromoCode,
    string DiscountType,
    decimal DiscountValue,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    string ValidityStatus,
    bool IsActive,
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
    bool IsActive
);
