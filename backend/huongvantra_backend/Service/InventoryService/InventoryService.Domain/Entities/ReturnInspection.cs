using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class ReturnInspection
{
    public Guid Id { get; set; }
    public Guid ReturnId { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuSnapshotName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public ReturnInspectionDisposition Disposition { get; set; } = ReturnInspectionDisposition.Pending;
    public Guid? QuarantineBatchId { get; set; }
    public Guid? RestockBatchId { get; set; }
    public Guid? InspectedBy { get; set; }
    public DateTime? InspectedAt { get; set; }
    public string? InspectionNote { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public WarehouseBatch? QuarantineBatch { get; set; }
}
