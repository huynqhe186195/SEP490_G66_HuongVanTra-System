namespace InventoryService.Domain.Entities;

public class StocktakeRequestItem
{
    public Guid Id { get; set; }
    public Guid StocktakeRequestId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? ProductTypeSnapshot { get; set; }
    public string? InventoryUnitSnapshot { get; set; }
    public int SystemQuantitySnapshot { get; set; }
    public int ActualQuantity { get; set; }
    public int Variance { get; set; }
    public string ReasonCode { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int? WarehouseQtyBefore { get; set; }
    public int? WarehouseQtyAfter { get; set; }
    public int? ShelfQtyBefore { get; set; }
    public int? ShelfQtyAfter { get; set; }
    public Guid? StockExportSlipId { get; set; }
    public string? StockExportSlipCode { get; set; }
    public Guid? StockImportSlipId { get; set; }
    public string? StockImportSlipCode { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }

    public StocktakeRequest? Request { get; set; }
    public StockExportSlip? StockExportSlip { get; set; }
    public StockImportSlip? StockImportSlip { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
}
