namespace OrderService.Domain.Entities;

/// <summary>
/// Bảng lưu idempotency key của payment confirmations để ngăn duplicate processing (EX-08).
/// Mỗi payment action (confirm, collect, refund) có một idempotency key riêng.
/// </summary>
public class PaymentIdempotency : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid PaymentId { get; set; }
    /// <summary>Idempotency key từ client hoặc webhook (UUID).</summary>
    public string IdempotencyKey { get; set; } = string.Empty;
    /// <summary>Loại action: "confirm", "collect", "refund".</summary>
    public string ActionType { get; set; } = string.Empty;
    /// <summary>Kết quả đã xử lý, trả về cho duplicate request.</summary>
    public string? ResultJson { get; set; }
    /// <summary>Mốc xử lý lần đầu.</summary>
    public DateTime ProcessedAt { get; set; }

    public Order Order { get; set; } = null!;
    public Payment Payment { get; set; } = null!;
}
