namespace OrderService.Domain.Enums;

public enum PackingStatus
{
    Pending,
    Packed,
    /// <summary>Đơn đã hủy — không đóng gói / không trừ nguyên liệu.</summary>
    Cancelled
}
