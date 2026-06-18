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
