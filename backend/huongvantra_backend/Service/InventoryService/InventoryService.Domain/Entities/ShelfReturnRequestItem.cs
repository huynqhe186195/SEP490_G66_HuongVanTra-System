namespace InventoryService.Domain.Entities;

public class ShelfReturnRequestItem
{
    public Guid Id { get; set; }
    public Guid ShelfReturnRequestId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public Guid? ShelfBatchId { get; set; }
    public string? ShelfLotCode { get; set; }
    public int? ShelfQtyBefore { get; set; }
    public int? ShelfQtyAfter { get; set; }
    public int? WarehouseQtyBefore { get; set; }
    public int? WarehouseQtyAfter { get; set; }
    public Guid? StockExportSlipId { get; set; }
    public string? StockExportSlipCode { get; set; }
    public Guid? StockImportSlipId { get; set; }
    public string? StockImportSlipCode { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public string? Note { get; set; }

    public ShelfReturnRequest? ShelfReturnRequest { get; set; }
    public WarehouseBatch? ShelfBatch { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
}
