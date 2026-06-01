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
        public DateTime CreatedAt { get; set; }
        public List<PosOrderItemResult> Items { get; set; } = new();
    }
}
