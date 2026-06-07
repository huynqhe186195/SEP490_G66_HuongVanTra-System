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
    string CustomerCode,
    string FullName,
    string PhoneNumber,
    string? Email,
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
    string CustomerCode,
    string FullName,
    string PhoneNumber,
    string? Email,
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

public record CustomerDebtTransactionResponse(
    Guid Id,
    Guid CustomerId,
    DebtTransactionType Type,
    decimal Amount,
    decimal BalanceAfter,
    string? ReferenceType,
    Guid? ReferenceId,
    string? Note,
    DateTime CreatedAt
);

public record CustomerDebtSummaryResponse(
    decimal CurrentDebt,
    decimal TotalIncrease,
    decimal TotalDecrease,
    int TransactionCount
);

public record CustomerActivityResponse(
    Guid Id,
    Guid CustomerId,
    CustomerActivityType ActivityType,
    string Description,
    DateTime CreatedAt
);

public record TierCountResponse(string TierName, int Count);

public record CustomerStatisticsResponse(
    int TotalCustomers,
    int NewCustomersThisMonth,
    IEnumerable<CustomerResponse> TopSpenders,
    IEnumerable<CustomerResponse> TopDebtors,
    IEnumerable<TierCountResponse> CustomersByTier
);
