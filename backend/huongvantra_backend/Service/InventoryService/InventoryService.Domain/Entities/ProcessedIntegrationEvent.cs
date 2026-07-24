namespace InventoryService.Domain.Entities;

/// <summary>
/// Inbox record — đánh dấu một integration event đã được InventoryService xử lý,
/// phục vụ idempotent consumer (chống xử lý trùng khi broker giao at-least-once).
///
/// G6: <see cref="EventId"/> là khoá chống trùng có thẩm quyền (do OrderService Outbox
/// sinh và giữ nguyên khi publish). Bộ đôi (<see cref="EventType"/>,
/// <see cref="CorrelationId"/>) là khoá nghiệp vụ, đảm bảo hai EventId khác nhau cho
/// cùng một nghiệp vụ (ví dụ cùng OrderId) không gây tác động tồn kho lặp.
/// </summary>
public class ProcessedIntegrationEvent
{
    public Guid Id { get; set; }

    /// <summary>
    /// EventId có thẩm quyền của integration event (khớp OutboxMessage.Id / payload.EventId).
    /// Có thể null với event từ nguồn chưa gắn EventId (ví dụ SkuCreated của ProductService).
    /// </summary>
    public Guid? EventId { get; set; }

    public string EventType { get; set; } = string.Empty;

    /// <summary>Khoá nghiệp vụ của event (OrderId, ReturnId hoặc SkuId).</summary>
    public Guid CorrelationId { get; set; }

    public DateTime ProcessedAt { get; set; }
}
