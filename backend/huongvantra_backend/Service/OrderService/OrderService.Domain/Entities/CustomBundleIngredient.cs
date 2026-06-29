namespace OrderService.Domain.Entities;

public class CustomBundleIngredient : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CustomBundleId { get; set; }
    public Guid MaterialSkuId { get; set; }
    public string MaterialSkuCode { get; set; } = string.Empty;
    public string MaterialSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }
    public CustomBundle Bundle { get; set; } = null!;
}
