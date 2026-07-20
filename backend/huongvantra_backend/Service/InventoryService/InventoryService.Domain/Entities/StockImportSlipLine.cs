namespace InventoryService.Domain.Entities;

public class StockImportSlipLine
{
    public Guid Id { get; set; }
    public Guid StockImportSlipId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string ProductSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int WarehouseQtyBefore { get; set; }
    public int WarehouseQtyAfter { get; set; }
    public int StoreQtyBefore { get; set; }
    public int StoreQtyAfter { get; set; }
    public string? DestinationLocation { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public Guid? ProductionOrderOutputLineId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public StockImportSlip? ImportSlip { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
    public ProductionOrderOutputLine? ProductionOrderOutputLine { get; set; }
}
