namespace OrderService.Domain.Entities;

public class OrderReceiptPrintLog
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid? PrintedByUserId { get; set; }
    public string? PrintedByName { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int ReprintNumber { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime PrintedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Order Order { get; set; } = null!;
}
