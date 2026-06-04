namespace HuongVanTra.API.Models.Sales {
    public class SimulatePaymentWebhookRequest {
        public int OrderId { get; set; }
        public string? PaymentReference { get; set; }
        public string? Note { get; set; }
        /// <summary>Khớp PosTransferPayment:SimulateWebhookSecret nếu có cấu hình.</summary>
        public string? Secret { get; set; }
    }
}
