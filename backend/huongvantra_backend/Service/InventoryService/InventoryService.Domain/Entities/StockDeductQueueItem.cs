using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockDeductQueueItem
{
    public Guid Id { get; set; }
    public Guid QueueId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? SkuSnapshotCode { get; set; }
    public int Quantity { get; set; }
    public int? OrderedQuantity { get; set; }
    public int? FinishedDeductedQuantity { get; set; }
    public int? PendingBomQuantity { get; set; }

    /// <summary>
    /// POS-06 (KB2/KB3): phần hàng phải điều chuyển từ Kho thành phẩm về Kệ khi Thủ kho xác nhận.
    /// Tách khỏi FinishedDeductedQuantity vì phần này CHƯA bị trừ lúc thanh toán.
    /// </summary>
    public int? WarehouseTransferQuantity { get; set; }

    public string? MaterialRequirementSnapshotJson { get; set; }
    public string? StockHandlingMode { get; set; }

    /// <summary>POS-04: trạng thái giữ chỗ tồn Kệ Hàng của riêng dòng SKU này.</summary>
    public StockReservationStatus ReservationStatus { get; set; } = StockReservationStatus.None;

    /// <summary>Số lượng đang/đã giữ chỗ cho dòng này — nguồn của tổng giữ chỗ theo SKU.</summary>
    public int ReservedQuantity { get; set; }

    public DateTime? ReservedAt { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public DateTime? DeductedAt { get; set; }

    public StockDeductQueue Queue { get; set; } = null!;
}
