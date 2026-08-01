namespace InventoryService.Domain.Enums;

public enum StockAdjustmentRequestStatus
{
    Draft,
    Pending,
    Approved,
    Processing,
    PartiallyFulfilled,
    Fulfilled,
    Completed,
    Rejected,
    ClosedPartial,
    Cancelled
}
