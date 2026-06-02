namespace HuongVanTra.Service.Sales {
    public class VietQrTransferSettings {
        public const string SectionName = "PosTransferPayment";

        /// <summary>Mã ngân hàng trên Quick Link img.vietqr.io (VD: MB, VCB, TCB).</summary>
        public string BankCode { get; set; } = "MB";

        /// <summary>Mã BIN (acqId) — dùng cho API v2 generate, VD MB = 970422.</summary>
        public string BankBin { get; set; } = "970422";

        public string BankName { get; set; } = "";
        public string AccountNumber { get; set; } = "";
        public string AccountHolder { get; set; } = "";

        /// <summary>compact | compact2 | qr_only | print — theo tài liệu VietQR Quick Link.</summary>
        public string Template { get; set; } = "compact2";

        /// <summary>Tùy chọn: gọi POST https://api.vietqr.io/v2/generate khi có cả hai.</summary>
        public string? ClientId { get; set; }
        public string? ApiKey { get; set; }

        /// <summary>Bật POST webhooks/simulate-payment (mặc định chỉ Development).</summary>
        public bool AllowSimulateWebhook { get; set; }

        public string? SimulateWebhookSecret { get; set; }
    }
}
