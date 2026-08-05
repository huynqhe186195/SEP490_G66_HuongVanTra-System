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
    CancellationRequested,

    // POS-06: append cuối enum để không đổi giá trị số của các trạng thái đang lưu trong DB.
    /// <summary>KB2: chờ Thủ kho điều chuyển thành phẩm từ Kho lên Kệ.</summary>
    WaitingTransfer,
    /// <summary>KB3: chờ Thủ kho sản xuất từ nguyên liệu rồi điều chuyển lên Kệ.</summary>
    WaitingProduction,
    /// <summary>KB4: hàng đã sẵn sàng, chờ khách quay lại lấy và Sale xác nhận đã giao.</summary>
    ReadyToDeliver
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

public enum PaymentPurpose
{
    Full,
    Deposit,
    RemainingAtPickup
}
