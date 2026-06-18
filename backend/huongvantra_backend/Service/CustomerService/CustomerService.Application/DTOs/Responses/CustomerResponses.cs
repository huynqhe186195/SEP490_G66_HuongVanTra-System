using CustomerService.Domain.Enums;

namespace CustomerService.Application.DTOs.Responses;

public record CustomerTierResponse(
    int Id,
    string TierName,
    decimal MinSpendingThreshold,
    decimal DiscountPercent,
    int? ValidityMonths,
    bool IsActive = true,
    int CustomerCount = 0
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
    CustomerSource? Source,
    string? Department,
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
    CustomerSource? Source,
    string? Department,
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

public record CustomerOpenDebtResponse(
    Guid OrderId,
    string OrderCode,
    decimal OriginalDebt,
    decimal PaidAmount,
    decimal RemainingDebt,
    DateTime CreatedAt
);

public record CustomerDebtAllocationResponse(
    Guid OrderId,
    string OrderCode,
    decimal Amount,
    decimal RemainingAfter
);

public record CustomerDebtPaymentPreviewResponse(
    decimal RequestedAmount,
    decimal AllocatedAmount,
    decimal UnallocatedAmount,
    IReadOnlyList<CustomerDebtAllocationResponse> Allocations
);

public record CustomerDebtPaymentResponse(
    CustomerDebtTransactionResponse Transaction,
    IReadOnlyList<CustomerDebtAllocationResponse> Allocations,
    decimal AllocatedAmount,
    decimal UnallocatedAmount
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

public record CustomerImportRowResultResponse(
    int RowNumber,
    string? CustomerName,
    string? PhoneNumber,
    string Status,
    IReadOnlyList<string> Messages
);

public record CustomerImportResultResponse(
    int TotalRows,
    int SuccessCount,
    int FailedCount,
    int WarningCount,
    IReadOnlyList<CustomerImportRowResultResponse> Rows
);

public record CustomerExcelFileResponse(
    byte[] Content,
    string FileName,
    string ContentType
);
