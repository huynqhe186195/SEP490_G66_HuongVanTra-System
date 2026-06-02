namespace HuongVanTra.Service.Sales.Models {
    public class OrderConfirmationResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string PaymentMethod { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public string? InvoiceCode { get; set; }
        public DateTime ConfirmedAt { get; set; }
    }
}
