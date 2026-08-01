namespace InventoryService.Domain.Entities;

/// <summary>
/// Lần gửi báo cáo cuối ngày kho: lưu snapshot đầy đủ tại thời điểm gửi.
/// </summary>
public class WarehouseDailyReportSubmission
{
    public Guid Id { get; set; }
    public DateOnly BusinessDate { get; set; }
    public DateTime SentAtUtc { get; set; }

    public Guid SentBy { get; set; }
    public string SentByName { get; set; } = string.Empty;
    public string? SentByRoleName { get; set; }

    public int DoneTotal { get; set; }
    public int OpenCarryCount { get; set; }
    public int TotalWarehouseQuantity { get; set; }
    public int LowStockSkuCount { get; set; }
    public int ExpiringBatchCount30Days { get; set; }

    /// <summary>JSON đầy đủ WarehouseDailyReportResponse tại lúc gửi.</summary>
    public string SnapshotJson { get; set; } = string.Empty;
}
