namespace CustomerService.Application.DTOs.Requests;

public record CreateCustomerTierRequest(
    string TierName,
    decimal MinSpendingThreshold,
    decimal DiscountPercent,
    int? ValidityMonths
);

public record UpdateCustomerTierRequest(
    string TierName,
    decimal MinSpendingThreshold,
    decimal DiscountPercent,
    int? ValidityMonths
);
