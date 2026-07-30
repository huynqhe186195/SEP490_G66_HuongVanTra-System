namespace InventoryService.Domain.Enums;

public enum InventoryOutboxMessageStatus
{
    Pending = 0,
    Processing = 1,
    Published = 2,
    Failed = 3
}
