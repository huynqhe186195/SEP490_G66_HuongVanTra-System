namespace OrderService.Application.Interfaces;

/// <summary>
/// Ghi integration event vào Transactional Outbox của OrderService.
///
/// Writer chỉ thêm OutboxMessage vào DbContext hiện tại.
/// Writer không tự gọi SaveChanges và không publish RabbitMQ.
/// Vì vậy OutboxMessage có thể được lưu trong cùng transaction
/// với thay đổi Order, Payment hoặc Return.
/// </summary>
public interface IOrderOutboxWriter
{
    /// <summary>
    /// Thêm một integration event vào Outbox hiện tại.
    /// </summary>
    /// <typeparam name="TMessage">
    /// Kiểu contract của integration event cần được lưu.
    /// </typeparam>
    /// <param name="eventId">
    /// ID duy nhất của integration event.
    /// ID này phải trùng với EventId nằm trong payload sau khi
    /// các integration contract được nâng cấp ở G3.
    /// </param>
    /// <param name="aggregateId">
    /// ID của aggregate phát sinh event, thường là OrderId hoặc ReturnId.
    /// </param>
    /// <param name="message">
    /// Integration event sẽ được serialize thành JSON.
    /// </param>
    /// <param name="ct">
    /// Cancellation token của request hiện tại.
    /// </param>
    Task EnqueueAsync<TMessage>(
        Guid eventId,
        Guid aggregateId,
        TMessage message,
        CancellationToken ct = default)
        where TMessage : class;
}