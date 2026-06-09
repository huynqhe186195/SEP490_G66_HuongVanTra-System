namespace InventoryService.Domain.Entities;

public class StockExportSlip
{
    public Guid Id { get; set; }
    public string ExportCode { get; set; } = string.Empty;
    public string ExportType { get; set; } = "transfer_to_store";
    public Guid? StockAdjustmentRequestId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int WarehouseQtyBefore { get; set; }
    public int WarehouseQtyAfter { get; set; }
    public int StoreQtyBefore { get; set; }
    public int StoreQtyAfter { get; set; }
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<StockExportBatchAllocation> BatchAllocations { get; set; } = new List<StockExportBatchAllocation>();
}
