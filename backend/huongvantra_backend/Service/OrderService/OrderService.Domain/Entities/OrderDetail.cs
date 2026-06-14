namespace OrderService.Domain.Entities;

public class OrderDetail : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? SkuSnapshotCode { get; set; }
    public string? CategorySnapshotName { get; set; }
    public int Quantity { get; set; }
    public decimal CostPrice { get; set; }
    public int ReturnedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }
    public bool IsGift { get; set; }

    public Order Order { get; set; } = null!;
}
