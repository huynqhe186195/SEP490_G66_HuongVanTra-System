using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockDeductQueue
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string OrderPaymentStatus { get; set; } = string.Empty;
    public string OrderStockStatus { get; set; } = "pending_deduct";

    /// <summary>
    /// POS-04: snapshot tên khách hàng lấy từ OrderPlacedEvent — dùng để hiển thị đơn đang giữ chỗ
    /// từ màn hình SKU mà không truy vấn chéo database của OrderService/CustomerService.
    /// </summary>
    public string? CustomerSnapshotName { get; set; }
    public QueueStatus QueueStatus { get; set; } = QueueStatus.Waiting;
    public decimal TotalAmount { get; set; }
    public bool IsDeducted { get; set; }
    /// <summary>
    /// POS-04: đơn COD chờ xác nhận đã giữ chỗ tồn Kệ Hàng (ReservedQuantity đã cộng).
    /// Dùng để reserve/release idempotent — chỉ reserve khi false, chỉ release khi true.
    /// </summary>
    public bool IsReserved { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public string? ConfirmedByName { get; set; }
    public string? ConfirmedByRoleName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public string? CancelledByName { get; set; }
    public string? CancelledByRoleName { get; set; }
    public string? CancelReason { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public string? LastShortageReason { get; set; }
    public ICollection<StockDeductQueueItem> Items { get; set; } = new List<StockDeductQueueItem>();
}
