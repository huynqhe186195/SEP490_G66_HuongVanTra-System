namespace OrderService.Domain.Enums;

public enum OrderActivityType
{
    Created,
    Updated,
    PaymentPending,
    PaymentReceived,
    CodVerified,
    Shipped,
    Completed,
    Cancelled,
    InventorySynced,
    Returned
}
