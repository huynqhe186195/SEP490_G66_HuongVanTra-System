namespace InventoryService.Domain.Entities;

public class SupplierReturnRequestItem
{
    public Guid Id { get; set; }
    public Guid SupplierReturnRequestId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public int? WarehouseQtyBefore { get; set; }
    public int? WarehouseQtyAfter { get; set; }
    public int? ShelfQtyBefore { get; set; }
    public int? ShelfQtyAfter { get; set; }
    public Guid? StockExportSlipId { get; set; }
    public string? StockExportSlipCode { get; set; }
    public string? Note { get; set; }

    public SupplierReturnRequest? SupplierReturnRequest { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
}
