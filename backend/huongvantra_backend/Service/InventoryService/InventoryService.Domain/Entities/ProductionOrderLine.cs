namespace InventoryService.Domain.Entities;

public class ProductionOrderLine
{
    public Guid Id { get; set; }
    public Guid ProductionOrderId { get; set; }
    public Guid MaterialSkuId { get; set; }
    public string MaterialSkuCode { get; set; } = string.Empty;
    public string MaterialSnapshotName { get; set; } = string.Empty;
    public int PlannedQuantity { get; set; }
    public DateTime CreatedAt { get; set; }

    public ProductionOrder? Order { get; set; }
}
