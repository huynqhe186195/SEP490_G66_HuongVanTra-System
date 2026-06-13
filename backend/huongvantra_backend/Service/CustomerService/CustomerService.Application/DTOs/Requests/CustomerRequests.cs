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
