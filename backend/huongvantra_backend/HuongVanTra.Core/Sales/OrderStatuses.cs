namespace HuongVanTra.Core.Sales {
    public static class OrderStatuses {
        public const string Pending = "PENDING";
        public const string Confirmed = "CONFIRMED";
        public const string Packing = "PACKING";
        public const string Shipping = "SHIPPING";
        public const string Completed = "COMPLETED";
        public const string Cancelled = "CANCELLED";

        public static readonly string[] All = {
            Pending,
            Confirmed,
            Packing,
            Shipping,
            Completed,
            Cancelled,
        };

        public static bool IsValid(string? status) {
            return !string.IsNullOrWhiteSpace(status) &&
                   All.Contains(status, StringComparer.OrdinalIgnoreCase);
        }
    }
}
