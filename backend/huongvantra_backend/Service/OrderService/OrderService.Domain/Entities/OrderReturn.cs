using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class OrderReturn : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public decimal RefundedAmount { get; set; }
    public decimal ReturnValue { get; set; }
    
    public Order Order { get; set; } = null!;
}
