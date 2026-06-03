namespace HuongVanTra.Service.Sales {
    public class SepaySettings {
        public const string SectionName = "Sepay";

        public bool EnableWebhook { get; set; } = true;

        /// <summary>Secret token từ Sepay dashboard để validate webhook signature.</summary>
        public string WebhookSecret { get; set; } = "";

        /// <summary>Số tài khoản ngân hàng nhận tiền (dùng để verify accountNumber trong payload).</summary>
        public string AccountNumber { get; set; } = "";

        /// <summary>Bật mới so khớp số TK trong payload với Sepay:AccountNumber.</summary>
        public bool ValidateAccountNumber { get; set; }

        /// <summary>Sai lệch số tiền cho phép (VND). 0 = khớp chính xác.</summary>
        public decimal AmountToleranceVnd { get; set; } = 1000;
    }
}
