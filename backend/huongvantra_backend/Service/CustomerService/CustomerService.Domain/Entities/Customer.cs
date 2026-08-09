using CustomerService.Domain.Enums;

namespace CustomerService.Domain.Entities;

public class Customer : BaseEntity
{
    public Guid Id { get; set; }
    public string CustomerCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public CustomerGroup CustomerGroup { get; set; }
    public string? TaxCode { get; set; }
    public int? TierId { get; set; }
    public decimal TotalSpending { get; set; }
    public decimal CurrentDebt { get; set; }
    public Guid? AssignedSaleId { get; set; }
    public CustomerSource? Source { get; set; }
    public string? Department { get; set; }
    public string? RegisteredAddress { get; set; }
    public string? LegalRepresentativeName { get; set; }
    public string? LegalRepresentativePosition { get; set; }
    public string? LegalRepresentativeIdNumber { get; set; }
    public string? LegalRepresentativeIdIssuePlace { get; set; }
    public DateOnly? LegalRepresentativeIdIssueDate { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankName { get; set; }

    public CustomerTier? Tier { get; set; }
    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
    public ICollection<CustomerDebtTransaction> DebtTransactions { get; set; } = new List<CustomerDebtTransaction>();
    public ICollection<CustomerActivity> Activities { get; set; } = new List<CustomerActivity>();
}
