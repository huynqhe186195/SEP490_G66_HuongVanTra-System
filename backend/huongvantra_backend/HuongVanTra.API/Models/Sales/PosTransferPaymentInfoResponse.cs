namespace HuongVanTra.API.Models.Sales {
    public class PosTransferPaymentInfoResponse {
        public string BankCode { get; set; } = null!;
        public string BankBin { get; set; } = null!;
        public string BankName { get; set; } = null!;
        public string AccountNumber { get; set; } = null!;
        public string AccountHolder { get; set; } = null!;
        public string PaymentMode { get; set; } = "vietqr_main";
        public bool SepayOrderVaEnabled { get; set; }
        public bool SepayWebhookEnabled { get; set; }
    }
}
