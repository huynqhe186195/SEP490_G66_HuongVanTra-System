namespace HuongVanTra.API.Models.Sales {
    public class OrderConfirmationResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = string.Empty;
        public DateTime ConfirmedAt { get; set; }
        public string? InvoiceCode { get; set; }
    }
}
