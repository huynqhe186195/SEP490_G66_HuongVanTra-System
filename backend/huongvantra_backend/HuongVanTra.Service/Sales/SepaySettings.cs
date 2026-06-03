namespace HuongVanTra.Service.Sales {
    public class SepaySettings {
        public const string SectionName = "Sepay";

        public bool EnableWebhook { get; set; } = true;

        /// <summary>Secret token từ Sepay dashboard để validate webhook signature.</summary>
        public string WebhookSecret { get; set; } = "";

        /// <summary>Số tài khoản ngân hàng gốc (BIDV DN) đã liên kết SePay.</summary>
        public string AccountNumber { get; set; } = "";

        /// <summary>Bật mới so khớp số TK trong payload với Sepay:AccountNumber.</summary>
        public bool ValidateAccountNumber { get; set; }

        /// <summary>Sai lệch số tiền cho phép (VND). 0 = khớp chính xác.</summary>
        public decimal AmountToleranceVnd { get; set; } = 1000;

        /// <summary>SePay API v2 — tạo VA theo đơn (BIDV bắt buộc qua VA).</summary>
        public string ApiBaseUrl { get; set; } = "https://userapi.sepay.vn/v2";

        public string ApiToken { get; set; } = "";

        /// <summary>UUID tài khoản BIDV trên SePay (ba_xid).</summary>
        public string BankAccountUuid { get; set; } = "";

        /// <summary>VA cố định tạo sẵn trên dashboard (fallback nếu chưa bật API).</summary>
        public string StaticVaNumber { get; set; } = "";

        /// <summary>Thời hạn VA khi xem lại QR / đơn online (giây).</summary>
        public int VaDurationSeconds { get; set; } = 86400;

        /// <summary>POS / mang đi — khách quét tại quầy (mặc định 5 phút).</summary>
        public int PosVaDurationSeconds { get; set; } = 300;

        /// <summary>Không dùng QR VietQR vào TK chính — bắt buộc VA SePay (BIDV).</summary>
        public bool RequireSepayVaForTransfer { get; set; } = true;

        /// <summary>Tự lấy ba_xid từ GET /bank-accounts khi chỉ có ApiToken.</summary>
        public bool AutoResolveBankAccountUuid { get; set; } = true;

        public bool HasStaticVa => !string.IsNullOrWhiteSpace(StaticVaNumber);

        public bool IsOrderVaApiEnabled =>
            !string.IsNullOrWhiteSpace(ApiToken)
            && (!string.IsNullOrWhiteSpace(BankAccountUuid) || AutoResolveBankAccountUuid);
    }
}
