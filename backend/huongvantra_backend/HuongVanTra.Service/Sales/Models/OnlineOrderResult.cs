namespace HuongVanTra.Service.Sales.Models {
    public class OnlineOrderResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string StockStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public string? QrPayload { get; set; }
        public string? QrImageUrl { get; set; }
        public string? TransferContent { get; set; }
        public string? TransferAccountNumber { get; set; }
        public string PaymentMode { get; set; } = "vietqr_main";
        public DateTime? QrExpiresAtUtc { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<PosOrderItemResult> Items { get; set; } = new();
    }
}
