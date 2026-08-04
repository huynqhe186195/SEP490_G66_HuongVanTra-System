namespace OrderService.Domain.Enums;

public enum OrderStatus
{
    Draft,
    PendingPayment,
    Processing,
    Shipping,
    Completed,
    Cancelled,
    WaitingMaterials,
    CancellationRequested
}

public enum FulfillmentPreference
{
    PartialDelivery,
    CompleteDelivery
}

public enum BackorderRefundStatus
{
    NotRequired,
    PendingApproval,
    Approved,
    Completed,
    Rejected
}

public enum OrderChannel
{
    POS,
    Website,
    Zalo,
    Phone,
    COD,
    B2B
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
    COD,
    // Ghi nợ theo điều khoản hợp đồng B2B — không phải một lần thu tiền.
    Debt
}

public enum PaymentStatus
{
    Pending,
    Success,
    Failed,
    Deferred,
    Refunded
}

public enum PosCashSessionStatus
{
    Open,
    Closed
}
