using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockDeductQueue
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string OrderPaymentStatus { get; set; } = string.Empty;
    public string OrderStockStatus { get; set; } = "pending_deduct";
    public QueueStatus QueueStatus { get; set; } = QueueStatus.Waiting;
    public decimal TotalAmount { get; set; }
    public bool IsDeducted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public ICollection<StockDeductQueueItem> Items { get; set; } = new List<StockDeductQueueItem>();
}
