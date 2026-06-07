namespace CustomerService.Domain.Entities;

public class CustomerTier : BaseEntity
{
    public int Id { get; set; }
    public string TierName { get; set; } = string.Empty;
    public decimal MinSpendingThreshold { get; set; }
    public decimal DiscountPercent { get; set; }
    public int? ValidityMonths { get; set; }

    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
}
