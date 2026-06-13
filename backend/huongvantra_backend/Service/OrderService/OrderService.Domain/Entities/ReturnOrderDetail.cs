namespace OrderService.Domain.Entities;

public class ReturnOrderDetail : BaseEntity
{
    public Guid Id { get; set; }
    public Guid ReturnOrderId { get; set; }
    public Guid SourceOrderDetailId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? SkuSnapshotCode { get; set; }
    public int ReturnQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }

    public ReturnOrder ReturnOrder { get; set; } = null!;
}
