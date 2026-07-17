namespace InventoryService.Domain.Enums;

public enum ProductionOrderStatus
{
    Draft,
    PendingApproval,
    Approved,
    Completed,
    Rejected,
    Cancelled
}
