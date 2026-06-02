namespace HuongVanTra.Service.Sales {
    /// <summary>
    /// Giữ tương thích cũ — dùng <see cref="IVietQrService"/> thay cho placeholder.
    /// </summary>
    [Obsolete("Use IVietQrService instead.")]
    public static class VietQrHelper {
        [Obsolete("Use IVietQrService.GenerateForOrder instead.")]
        public static string GenerateQrPayload(string orderCode, decimal amount) {
            return $"VIETQR|{orderCode}|{amount:F0}";
        }
    }
}
