namespace InventoryService.Domain.Entities;

/// <summary>Phiếu/lô nhập kho — một mã lô có thể chứa nhiều SKU.</summary>
public class WarehouseBatch
{
    private string _batchCode = string.Empty;

    public Guid Id { get; set; }
    public string BatchCode
    {
        get => string.IsNullOrWhiteSpace(_batchCode) ? LotCode : _batchCode;
        set => _batchCode = value;
    }
    public string LotCode { get; set; } = string.Empty;
    public string? Supplier { get; set; }
    /// <summary>Chỉ set cho lô sinh từ Supplier Receipt. Lô cũ/lô nội bộ để null.</summary>
    public Guid? SupplierId { get; set; }
    /// <summary>SKU của lô nhà cung cấp — lô Supplier Receipt luôn đúng một SKU.</summary>
    public Guid? SkuId { get; set; }
    /// <summary>Bản trim + upper-case của LotCode (mã lô vật lý của NCC). Chỉ set cho lô Supplier Receipt.</summary>
    public string? NormalizedSupplierLotCode { get; set; }
    public DateTime? ManufactureDate { get; set; }
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
