namespace HuongVanTra.Service.Sales {
    public class SepaySettings {
        public const string SectionName = "Sepay";

        public bool EnableWebhook { get; set; } = true;

        /// <summary>Secret token từ Sepay dashboard để validate webhook signature.</summary>
        public string WebhookSecret { get; set; } = "";

        /// <summary>Số tài khoản ngân hàng nhận tiền (dùng để verify accountNumber trong payload).</summary>
        public string AccountNumber { get; set; } = "";
    }
}
