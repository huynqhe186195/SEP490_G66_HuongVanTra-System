using CustomerService.Domain.Enums;

namespace CustomerService.Domain.Entities;

public class CustomerDebtTransaction
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public DebtTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? RelatedOrderCode { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public ICollection<CustomerDebtAllocation> Allocations { get; set; } = new List<CustomerDebtAllocation>();
}
