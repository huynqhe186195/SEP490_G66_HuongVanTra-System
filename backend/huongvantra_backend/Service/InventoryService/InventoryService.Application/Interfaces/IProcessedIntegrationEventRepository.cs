namespace InventoryService.Application.Interfaces;

/// <summary>
/// Inbox của InventoryService — kiểm tra và ghi nhận integration event đã xử lý.
///
/// G6: dedupe hai tầng —
/// 1. <c>ExistsByEventIdAsync</c>: EventId là khoá chống trùng có thẩm quyền
///    (broker redeliver cùng một event → EventId trùng → bỏ qua).
/// 2. <c>ExistsAsync(eventType, correlationId)</c>: khoá nghiệp vụ — hai EventId
///    khác nhau nhưng cùng nghiệp vụ (cùng OrderId/ReturnId) cũng không được
///    gây tác động tồn kho lần thứ hai.
///
/// Ghi nhận qua <c>AddAsync</c> phải nằm trong cùng transaction/SaveChanges với
/// thay đổi nghiệp vụ để inbox + mutation là nguyên tử.
/// </summary>
public interface IProcessedIntegrationEventRepository
{
    /// <summary>Đã xử lý event có EventId này chưa (khoá có thẩm quyền)?</summary>
    Task<bool> ExistsByEventIdAsync(Guid eventId, CancellationToken ct = default);

    /// <summary>Đã xử lý nghiệp vụ (eventType, correlationId) này chưa (khoá nghiệp vụ)?</summary>
    Task<bool> ExistsAsync(string eventType, Guid correlationId, CancellationToken ct = default);

    /// <summary>
    /// Ghi nhận event đã xử lý. <paramref name="eventId"/> null với event
    /// từ nguồn chưa gắn EventId (ví dụ SkuCreated).
    /// Không tự SaveChanges — caller commit cùng thay đổi nghiệp vụ.
    /// </summary>
    Task AddAsync(string eventType, Guid correlationId, Guid? eventId = null, CancellationToken ct = default);

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
