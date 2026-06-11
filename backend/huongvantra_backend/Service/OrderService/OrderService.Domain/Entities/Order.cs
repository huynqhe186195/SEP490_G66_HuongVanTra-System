using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class Order : BaseEntity
{
    public Guid Id { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string? CustomerSnapshotName { get; set; }
    public Guid? EmployeeId { get; set; }
    public OrderChannel OrderChannel { get; set; }
    public OrderStatus OrderStatus { get; set; }
    public InventorySyncStatus InventorySyncStatus { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public Guid? PromotionId { get; set; }
    public string? PromotionCode { get; set; }
    public decimal PromotionDiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public string? ShippingAddress { get; set; }
    public string? Note { get; set; }

    public ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<OrderReturn> Returns { get; set; } = new List<OrderReturn>();
}
