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
    Guid? AssignedSaleId
);

public record UpdateCustomerRequest(
    string FullName,
    string PhoneNumber,
    string? Email,
    string AddressLine,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    Guid? AssignedSaleId
);

public record RecordDebtTransactionRequest(
    DebtTransactionType Type,
    decimal Amount,
    string? Note
);
