namespace InventoryService.Domain.Enums;

public enum StocktakeStatus
{
    Draft = 0,
    PendingApproval = 1,
    Completed = 2,
    Rejected = 3,
    Cancelled = 4
}
