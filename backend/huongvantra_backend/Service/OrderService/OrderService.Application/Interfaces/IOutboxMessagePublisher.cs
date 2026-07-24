namespace OrderService.Application.Interfaces;

/// <summary>
/// G5.3 — trừu tượng publish một integration event đã lấy từ Outbox lên message broker.
/// Tách khỏi MassTransit để dispatch loop có thể kiểm thử bằng test double.
/// </summary>
public interface IOutboxMessagePublisher
{
    /// <summary>
    /// Publish message.
    /// </summary>
    /// <param name="eventType">Tên contract (allowlist) của event.</param>
    /// <param name="payloadJson">Payload JSON đã lưu trong Outbox.</param>
    /// <param name="eventId">EventId, trùng OutboxMessage.Id, giữ nguyên khi publish.</param>
    /// <param name="ct">Cancellation token.</param>
    Task PublishAsync(string eventType, string payloadJson, Guid eventId, CancellationToken ct = default);
}

/// <summary>
/// Ném ra khi EventType không nằm trong allowlist hoặc payload không thể deserialize.
/// Đây là lỗi vĩnh viễn (poison message) → dispatcher chuyển thẳng sang Failed.
/// </summary>
public sealed class OutboxPermanentPublishException(string message) : Exception(message);
