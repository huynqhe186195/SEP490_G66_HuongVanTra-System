namespace HuongVanTra.API.Models.Sales {
    public class PosOrderPaymentStatusResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = string.Empty;
        public bool IsPaid { get; set; }
        public string? InvoiceCode { get; set; }
        public string? ExpectedTransferContent { get; set; }
        public decimal ExpectedAmount { get; set; }
    }
}
