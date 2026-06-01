namespace HuongVanTra.Service.Sales {
    public static class VietQrHelper {
        // TODO: Replace with real VietQR provider integration when credentials are configured.
        // Current implementation generates a deterministic placeholder payload from order_code + amount.
        public static string GenerateQrPayload(string orderCode, decimal amount) {
            // Placeholder format: VIETQR|<orderCode>|<amount>
            // Real integration should call VietQR API with bank account config from IConfiguration.
            return $"VIETQR|{orderCode}|{amount:F0}";
        }
    }
}
