namespace InventoryService.Domain.Entities;

public class ProductionOrderOutputLine
{
    public Guid Id { get; set; }
    public Guid ProductionOrderId { get; set; }
    public Guid FinishedSkuId { get; set; }
    public string FinishedSkuCode { get; set; } = string.Empty;
    public string FinishedSkuSnapshotName { get; set; } = string.Empty;
    public int PlannedQuantity { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public DateTime CreatedAt { get; set; }

    public ProductionOrder? Order { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
}
