using CustomerService.Domain.Enums;

namespace CustomerService.Application.DTOs.Responses;

public record CustomerTierResponse(
    int Id,
    string TierName,
    decimal MinSpendingThreshold,
    decimal DiscountPercent,
    int? ValidityMonths
);

public record CustomerResponse(
    Guid Id,
    string FullName,
    string PhoneNumber,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    string? TierName,
    decimal TotalSpending,
    decimal CurrentDebt,
    Guid? AssignedSaleId,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CustomerDetailResponse(
    Guid Id,
    string FullName,
    string PhoneNumber,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    CustomerTierResponse? Tier,
    decimal TotalSpending,
    decimal CurrentDebt,
    Guid? AssignedSaleId,
    IEnumerable<CustomerAddressResponse> Addresses,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
