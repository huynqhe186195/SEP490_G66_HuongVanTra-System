namespace InventoryService.Domain.Entities;

public class StockExportSlipLine
{
    public Guid Id { get; set; }
    public Guid StockExportSlipId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string ProductSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int WarehouseQtyBefore { get; set; }
    public int WarehouseQtyAfter { get; set; }
    public int StoreQtyBefore { get; set; }
    public int StoreQtyAfter { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public StockExportSlip? ExportSlip { get; set; }
    public ICollection<StockExportBatchAllocation> BatchAllocations { get; set; } = new List<StockExportBatchAllocation>();
}
