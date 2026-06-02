namespace HuongVanTra.Service.Sales.Models {
    public class VietQrGenerateResult {
        /// <summary>URL ảnh QR từ img.vietqr.io hoặc API VietQR.</summary>
        public string QrImageUrl { get; set; } = null!;

        /// <summary>Chuỗi EMV (chỉ có khi gọi API v2 thành công).</summary>
        public string? QrPayload { get; set; }

        public string TransferContent { get; set; } = null!;
    }
}
