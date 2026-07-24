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
    Phone,
    COD
}

public enum OrderKind
{
    Sale,
    Exchange
}

public enum InventorySyncStatus
{
    Synced,
    PendingDeduction,
    PendingReconciliation,
    Cancelled
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

public enum PosCashSessionStatus
{
    Open,
    Closed
}
