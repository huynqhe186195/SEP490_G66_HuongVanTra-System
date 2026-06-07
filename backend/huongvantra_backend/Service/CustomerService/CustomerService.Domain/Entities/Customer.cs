using CustomerService.Domain.Enums;

namespace CustomerService.Domain.Entities;

public class Customer : BaseEntity
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public CustomerGroup CustomerGroup { get; set; }
    public string? TaxCode { get; set; }
    public int? TierId { get; set; }
    public decimal TotalSpending { get; set; }
    public decimal CurrentDebt { get; set; }
    public Guid? AssignedSaleId { get; set; }

    public CustomerTier? Tier { get; set; }
    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
}
