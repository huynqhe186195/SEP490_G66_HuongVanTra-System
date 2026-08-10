namespace DocumentService.Application.Interfaces;

public interface ICustomerCatalogClient
{
    Task<CustomerCatalogProfile?> GetCustomerAsync(Guid customerId, CancellationToken ct = default);
    Task<List<CustomerCatalogProfile>> SearchCustomersAsync(string query, CancellationToken ct = default);
}

public sealed record CustomerCatalogProfile(
    Guid Id,
    string FullName,
    string CustomerCode,
    string CustomerGroup,
    string? TaxCode = null,
    string? RegisteredAddress = null,
    string? LegalRepresentativeName = null,
    string? LegalRepresentativePosition = null,
    string? LegalRepresentativeIdNumber = null,
    string? LegalRepresentativeIdIssuePlace = null,
    string? LegalRepresentativeIdIssueDate = null,
    string? BankAccountNumber = null,
    string? BankName = null,
    string? PhoneNumber = null)
{
    public bool IsDoanhNghiep =>
        string.Equals(CustomerGroup, "DoanhNghiep", StringComparison.OrdinalIgnoreCase);

    public bool HasLegalFields =>
        !string.IsNullOrWhiteSpace(LegalRepresentativeName) &&
        !string.IsNullOrWhiteSpace(LegalRepresentativeIdNumber) &&
        !string.IsNullOrWhiteSpace(BankAccountNumber);
}

