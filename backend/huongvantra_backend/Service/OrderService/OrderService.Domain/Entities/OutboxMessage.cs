using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

/// <summary>
/// Integration event được lưu trong cùng database transaction với thay đổi nghiệp vụ
/// của OrderService. Message sẽ được một background dispatcher publish lên RabbitMQ
/// sau khi business transaction đã commit thành công.
/// </summary>
public class OutboxMessage
{
    /// <summary>
    /// ID duy nhất của integration event.
    /// Giá trị này cũng sẽ được sử dụng làm EventId để consumer chống xử lý trùng.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Tên contract/event cần được publish.
    /// Ví dụ: OrderPlacedEvent hoặc OrderCancelledEvent.
    /// </summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// ID của aggregate phát sinh event.
    /// Trong phạm vi hiện tại chủ yếu là OrderId hoặc ReturnOrderId.
    /// </summary>
    public Guid AggregateId { get; set; }

    /// <summary>
    /// Nội dung event đã được serialize thành JSON.
    /// </summary>
    public string Payload { get; set; } = string.Empty;

    /// <summary>
    /// Trạng thái hiện tại của message.
    /// </summary>
    public OutboxMessageStatus Status { get; set; } = OutboxMessageStatus.Pending;

    /// <summary>
    /// Số lần dispatcher đã thử publish message nhưng thất bại.
    /// </summary>
    public int RetryCount { get; set; }

    /// <summary>
    /// Thời điểm nghiệp vụ phát sinh event.
    /// Toàn bộ thời gian trong Outbox sử dụng UTC.
    /// </summary>
    public DateTime OccurredAtUtc { get; set; }

    /// <summary>
    /// Thời điểm dispatcher thử publish gần nhất.
    /// </summary>
    public DateTime? LastAttemptAtUtc { get; set; }

    /// <summary>
    /// Thời điểm sớm nhất dispatcher được phép retry message.
    /// </summary>
    public DateTime NextAttemptAtUtc { get; set; }

    /// <summary>
    /// Thời điểm hết hạn claim của dispatcher hiện tại.
    /// Cho phép worker khác lấy lại message nếu worker cũ bị crash.
    /// </summary>
    public DateTime? LockedUntilUtc { get; set; }

    /// <summary>
    /// Tên hoặc định danh của dispatcher đang claim message.
    /// </summary>
    public string? LockedBy { get; set; }

    /// <summary>
    /// Thời điểm message được publish thành công.
    /// </summary>
    public DateTime? PublishedAtUtc { get; set; }

    /// <summary>
    /// Nội dung lỗi gần nhất khi publish thất bại.
    /// </summary>
    public string? LastError { get; set; }
}