namespace InventoryService.Domain.Enums;

/// <summary>
/// POS-04: vòng đời giữ chỗ tồn Kệ Hàng ở cấp dòng SKU của một đơn COD.
/// Chỉ <see cref="Active"/> mới tính vào tổng đang giữ; Released/Deducted giữ lại để truy vết lịch sử.
/// </summary>
public enum StockReservationStatus
{
    /// <summary>Chưa từng giữ chỗ (đơn không phải COD hoặc giữ chỗ thất bại).</summary>
    None = 0,

    /// <summary>Đang giữ chỗ — đã cộng vào SkuStock.ReservedQuantity.</summary>
    Active = 1,

    /// <summary>Đã giải phóng (đơn hủy trước khi giao) — đã trừ khỏi ReservedQuantity.</summary>
    Released = 2,

    /// <summary>Đã chuyển thành xuất kho (đơn bàn giao giao hàng) — tồn vật lý đã rời quầy.</summary>
    Deducted = 3,
}
