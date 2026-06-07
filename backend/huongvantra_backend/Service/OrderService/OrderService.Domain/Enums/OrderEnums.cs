namespace OrderService.Domain.Enums;

public enum OrderStatus
{
    Draft,
    PendingPayment,
    Processing,
    Shipping,
    Completed,
    Cancelled
}

public enum OrderChannel
{
    POS,
    Website,
    Zalo,
    Phone
}

public enum InventorySyncStatus
{
    Synced,
    PendingDeduction
}

public enum PaymentMethod
{
    Cash,
    VietQR,
    BankTransfer,
    COD
}

public enum PaymentStatus
{
    Pending,
    Success,
    Failed
}
