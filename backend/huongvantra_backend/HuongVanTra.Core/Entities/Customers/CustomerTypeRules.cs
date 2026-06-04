namespace HuongVanTra.Core.Entities.Customers {
    public static class CustomerTypeRules {
        public static bool SupportsMembershipTier(string? customerType) {
            var normalized = (customerType ?? string.Empty).Trim().ToUpperInvariant();
            return normalized is "GENERAL" or "RETAIL";
        }

        public static bool IsVip(string? customerType) {
            var normalized = (customerType ?? string.Empty).Trim().ToUpperInvariant();
            return normalized is "VIP" or "VVIP";
        }
    }
}
