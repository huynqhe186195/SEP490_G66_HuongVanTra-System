using InventoryService.Domain.Enums;

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

    public int ApprovedQuantity { get; set; }
    public int FulfilledQuantity { get; set; }
    public int RejectedQuantity { get; set; }
    public StockAdjustmentRequestItemStatus Status { get; set; } = StockAdjustmentRequestItemStatus.Pending;
    public string? ReviewNote { get; set; }
    public string? RejectionReason { get; set; }
    public string? ClosedReason { get; set; }
    public Guid? AutoProductionOrderId { get; set; }
    public ProductionOrder? AutoProductionOrder { get; set; }

    /// <summary>Số lượng còn phải bổ sung lên Kệ Hàng; luôn dẫn xuất, không lưu database.</summary>
    public int RemainingQuantity => Math.Max(0, QuantityDelta - FulfilledQuantity - RejectedQuantity);
}
