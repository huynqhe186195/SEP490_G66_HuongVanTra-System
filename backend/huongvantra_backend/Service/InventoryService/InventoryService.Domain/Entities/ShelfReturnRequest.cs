using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

public class ShelfReturnRequest
{
    public Guid Id { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public string ReturnMode { get; set; } = "PHYSICAL_RETURN";
    public Guid? OriginalStockAdjustmentRequestId { get; set; }
    public string? OriginalStockAdjustmentRequestCode { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public InventoryReturnRequestStatus Status { get; set; } = InventoryReturnRequestStatus.Pending;
    public Guid CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? CreatedByRoleName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewedByRoleName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }

    public ICollection<ShelfReturnRequestItem> Items { get; set; } = new List<ShelfReturnRequestItem>();
}
