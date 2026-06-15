namespace InventoryService.Domain.Entities;

public class StockAdjustmentRequestItem
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public StockAdjustmentRequest? Request { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int QuantityDelta { get; set; }
    public int QuantityOnHandSnapshot { get; set; }
    public int? QuantityOnHandAfter { get; set; }
    public int? WarehouseQuantityOnHandAfter { get; set; }
    public Guid? ExportSlipId { get; set; }
    public StockExportSlip? ExportSlip { get; set; }
}
