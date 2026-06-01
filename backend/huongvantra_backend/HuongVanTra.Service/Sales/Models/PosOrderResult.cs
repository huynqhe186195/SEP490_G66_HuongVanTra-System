namespace HuongVanTra.Service.Sales.Models {
    public class PosOrderResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = null!;
        public string StockStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public List<PosOrderItemResult> Items { get; set; } = new();
    }

    public class PosOrderItemResult {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public byte IsGift { get; set; }
    }
}
