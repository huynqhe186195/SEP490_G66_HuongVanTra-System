using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class StockAdjustmentRequest
{
    public Guid Id { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public StockAdjustmentRequestStatus Status { get; set; } = StockAdjustmentRequestStatus.Pending;
    public Guid RequestedBy { get; set; }
    public DateTime RequestedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public List<StockAdjustmentRequestItem> Items { get; set; } = [];
}
