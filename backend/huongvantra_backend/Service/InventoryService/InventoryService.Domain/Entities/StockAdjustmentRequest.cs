using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockAdjustmentRequest
{
    public Guid Id { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int QuantityDelta { get; set; }
    public string? Reason { get; set; }
    public StockAdjustmentRequestStatus Status { get; set; } = StockAdjustmentRequestStatus.Pending;
    public int QuantityOnHandSnapshot { get; set; }
    public int? QuantityOnHandAfter { get; set; }
    public int? WarehouseQuantityOnHandAfter { get; set; }
    public Guid RequestedBy { get; set; }
    public DateTime RequestedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public Guid? ExportSlipId { get; set; }
    public StockExportSlip? ExportSlip { get; set; }
}
