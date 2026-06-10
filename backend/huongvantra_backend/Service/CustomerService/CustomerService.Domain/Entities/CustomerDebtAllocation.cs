namespace CustomerService.Domain.Entities;

public class CustomerDebtAllocation
{
    public Guid Id { get; set; }
    public Guid DebtTransactionId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; }

    public CustomerDebtTransaction DebtTransaction { get; set; } = null!;
}
