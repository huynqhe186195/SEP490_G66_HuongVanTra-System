using CustomerService.Domain.Enums;

namespace CustomerService.Application.DTOs.Requests;

public record CreateCustomerRequest(
    string FullName,
    string PhoneNumber,
    string? Email,
    string AddressLine,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    Guid? AssignedSaleId,
    CustomerSource? Source = null,
    string? Department = null
);

public record UpdateCustomerRequest(
    string FullName,
    string PhoneNumber,
    string? Email,
    string AddressLine,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    Guid? AssignedSaleId,
    CustomerSource? Source = null,
    string? Department = null
);

public class CustomerExportRequest
{
    public string? Keyword { get; set; }
    public string? CustomerType { get; set; }
    public string? TierCode { get; set; }
    public int? TierId { get; set; }
    public string? DebtFilter { get; set; }
    public string? SortBy { get; set; }
    public string? ActiveTab { get; set; }
}

public record RecordDebtTransactionRequest(
    DebtTransactionType Type,
    decimal Amount,
    string? Note
);

public record DebtAllocationItemRequest(
    Guid OrderId,
    decimal Amount
);

public record ApplyDebtPaymentRequest(
    decimal Amount,
    string? Note,
    Guid? SourceOrderId = null,
    IReadOnlyList<DebtAllocationItemRequest>? Allocations = null
);

/// <summary>
/// DTO nội bộ để deserialize Payment.CodDebtSettlementJson — không expose ra API.
/// Format khớp với serializeCodDebtSettlement() ở frontend.
/// </summary>
public record CodDebtSettlement(
    bool PayDebtsEnabled,
    decimal AllocatedAmount,
    IReadOnlyList<CodDebtAllocationItem> Allocations,
    decimal CreditToCustomer = 0
);

public record CodDebtAllocationItem(
    Guid OrderId,
    decimal Amount
);
