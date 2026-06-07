using CustomerService.Domain.Enums;

namespace CustomerService.Application.DTOs.Requests;

public record CreateCustomerRequest(
    string FullName,
    string PhoneNumber,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    Guid? AssignedSaleId
);

public record UpdateCustomerRequest(
    string FullName,
    string PhoneNumber,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    Guid? AssignedSaleId
);
