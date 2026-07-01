namespace InventoryService.Domain.Entities;

public class StockImportSlip
{
    public Guid Id { get; set; }
    public string ImportCode { get; set; } = string.Empty;
    public string ImportType { get; set; } = string.Empty;
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string ProductSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int WarehouseQtyBefore { get; set; }
    public int WarehouseQtyAfter { get; set; }
    public int StoreQtyBefore { get; set; }
    public int StoreQtyAfter { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public Guid? ProductionOrderId { get; set; }
    public string? ProductionCode { get; set; }
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
