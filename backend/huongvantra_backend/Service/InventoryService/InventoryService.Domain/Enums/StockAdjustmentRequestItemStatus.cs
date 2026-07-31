namespace InventoryService.Domain.Enums;

public enum StockAdjustmentRequestItemStatus
{
    Pending,
    Approved,
    WaitingForStock,
    PartiallyFulfilled,
    Fulfilled,
    Rejected,
    ClosedPartial,
    Cancelled
}
