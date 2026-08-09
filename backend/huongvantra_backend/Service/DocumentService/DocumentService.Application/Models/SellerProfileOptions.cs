namespace DocumentService.Application.Models;

public sealed class SellerProfileOptions
{
    public string CompanyName { get; set; } = string.Empty;
    public string TaxCode { get; set; } = string.Empty;
    public string RegisteredAddress { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string LegalRepresentativeName { get; set; } = string.Empty;
    public string LegalRepresentativePosition { get; set; } = string.Empty;
    public string LegalRepresentativeIdNumber { get; set; } = string.Empty;
    public string LegalRepresentativeIdIssuePlace { get; set; } = string.Empty;
    public string LegalRepresentativeIdIssueDate { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
}
