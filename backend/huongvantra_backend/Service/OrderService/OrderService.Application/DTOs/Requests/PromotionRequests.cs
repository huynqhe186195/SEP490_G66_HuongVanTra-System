namespace OrderService.Application.DTOs.Requests;

public record CreatePromotionRequest(
    string? PromoCode,
    string? DiscountType,
    decimal DiscountValue,
    DateOnly? ValidFrom,
    DateOnly? ValidTo
);

public record UpdatePromotionRequest(
    string? PromoCode,
    string? DiscountType,
    decimal DiscountValue,
    DateOnly? ValidFrom,
    DateOnly? ValidTo
);
