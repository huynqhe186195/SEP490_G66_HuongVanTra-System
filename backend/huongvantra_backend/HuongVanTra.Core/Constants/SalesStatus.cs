namespace HuongVanTra.Core.Constants {
    public static class QueueStatus {
        public const string Waiting     = "waiting";
        public const string Confirmed   = "confirmed";
        public const string Insufficient = "insufficient";
        public const string Cancelled   = "cancelled";
    }

    public static class OrderStockStatus {
        public const string PendingDeduct = "pending_deduct";
        public const string Deducted      = "deducted";
        public const string WaitingStock  = "waiting_stock";
        public const string Cancelled     = "cancelled";
    }

    public static class ShortageStatus {
        public const string WaitingStock = "waiting_stock";
        public const string Resolved     = "resolved";
        public const string Cancelled    = "cancelled";
    }

    public static class PaymentStatus {
        public const string Paid           = "paid";
        public const string Unpaid         = "unpaid";
        public const string PendingPayment = "pending_payment";
        public const string Pending        = "pending";
    }

    public static class OrderStatus {
        public const string Confirmed  = "confirmed";
        public const string Completed  = "completed";
        public const string Cancelled  = "cancelled";
    }
}
