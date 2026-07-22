namespace InventoryService.Domain.Entities;

/// <summary>Phiếu/lô nhập kho — một mã lô có thể chứa nhiều SKU.</summary>
public class WarehouseBatch
{
    public Guid Id { get; set; }
    public string LotCode { get; set; } = string.Empty;
    public string? Supplier { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Note { get; set; }
    public string? SourceType { get; set; }
    public Guid? SourceReferenceId { get; set; }
    public string? SourceReferenceCode { get; set; }
    public string Location { get; set; } = "Warehouse";
    public Guid? ParentBatchId { get; set; }
    public Guid? SourceBatchId { get; set; }
    /// <summary>active | depleted</summary>
    public string Status { get; set; } = "active";
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<WarehouseBatchItem> Items { get; set; } = new List<WarehouseBatchItem>();
    public WarehouseBatch? ParentBatch { get; set; }
    public WarehouseBatch? SourceBatch { get; set; }
}
