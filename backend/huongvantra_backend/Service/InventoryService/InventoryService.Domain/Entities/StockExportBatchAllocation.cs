namespace InventoryService.Domain.Entities;

/// <summary>Chi tiết dòng lô bị trừ khi xuất kho sang cửa hàng.</summary>
public class StockExportBatchAllocation
{
    public Guid Id { get; set; }
    public Guid StockExportSlipId { get; set; }
    public Guid? StockExportSlipLineId { get; set; }
    public Guid WarehouseBatchId { get; set; }
    public Guid WarehouseBatchItemId { get; set; }
    public string LotCode { get; set; } = string.Empty;
    public string SkuCode { get; set; } = string.Empty;
    public int Quantity { get; set; }

    public StockExportSlip? ExportSlip { get; set; }
    public StockExportSlipLine? ExportSlipLine { get; set; }
    public WarehouseBatch? Batch { get; set; }
    public WarehouseBatchItem? BatchItem { get; set; }
}
