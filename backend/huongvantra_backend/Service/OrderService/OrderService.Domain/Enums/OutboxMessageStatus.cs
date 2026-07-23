namespace OrderService.Domain.Enums;

/// <summary>
/// Trạng thái xử lý của một integration event trong Transactional Outbox.
/// </summary>
public enum OutboxMessageStatus
{
    /// <summary>
    /// Message đã được lưu cùng business transaction nhưng chưa được publish.
    /// </summary>
    Pending = 0,

    /// <summary>
    /// Message đang được một dispatcher tạm thời claim để publish.
    /// </summary>
    Processing = 1,

    /// <summary>
    /// Message đã được publish thành công lên message broker.
    /// </summary>
    Published = 2,

    /// <summary>
    /// Message đã vượt quá giới hạn retry hoặc gặp lỗi không thể tiếp tục tự động.
    /// </summary>
    Failed = 3
}