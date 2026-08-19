using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockTransfer
{
    public Guid Id { get; set; }
    public string TransferCode { get; set; } = string.Empty;
    public string SourceLocation { get; set; } = "Warehouse";
    public string DestinationLocation { get; set; } = "Shelf";
    public StockTransferStatus Status { get; set; } = StockTransferStatus.Draft;
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CompletedBy { get; set; }
    public string? CompletedByName { get; set; }
    public string? CompletedByRoleName { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public Guid? ExportSlipId { get; set; }
    public Guid? ImportSlipId { get; set; }

    /// <summary>Yêu cầu bổ sung Kệ Hàng nguồn; một yêu cầu có thể sinh nhiều phiếu điều chuyển.</summary>
    public Guid? SourceRequestId { get; set; }
    public StockAdjustmentRequest? SourceRequest { get; set; }

    /// <summary>Gợi ý bổ sung Kệ Hàng nguồn; đánh dấu đã xử lý khi phiếu hoàn tất.</summary>
    public Guid? SourceSuggestionId { get; set; }
    public ShelfReplenishmentSuggestion? SourceSuggestion { get; set; }

    /// <summary>
    /// POS-06: đơn hàng nguồn khi phiếu được sinh tự động từ bán trước trừ sau (Scenario 2/3).
    /// Dùng để truy vết phiếu điều chuyển về đơn hàng gốc.
    /// </summary>
    public Guid? SourceOrderId { get; set; }

    /// <summary>
    /// POS-06: mã đơn hàng nguồn để hiển thị trong danh sách (snapshot).
    /// </summary>
    public string? SourceOrderCode { get; set; }

    /// <summary>
    /// POS-06: kênh đơn hàng nguồn ("POS" hoặc "COD") để phân biệt loại phiếu trong danh sách.
    /// Null khi phiếu không sinh từ đơn hàng.
    /// </summary>
    public string? SourceOrderChannel { get; set; }

    public StockExportSlip? ExportSlip { get; set; }
    public StockImportSlip? ImportSlip { get; set; }
    public ICollection<StockTransferLine> Lines { get; set; } = new List<StockTransferLine>();
    public ICollection<StockTransferBatchAllocation> BatchAllocations { get; set; } = new List<StockTransferBatchAllocation>();
}
