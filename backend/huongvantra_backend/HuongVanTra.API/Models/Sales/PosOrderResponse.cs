namespace HuongVanTra.API.Models.Sales {
    public class PosOrderResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = null!;
        public string StockStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public string? QrPayload { get; set; }
        public string? QrImageUrl { get; set; }
        public string? TransferContent { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<PosOrderItemResponse> Items { get; set; } = new();
    }

    public class PosOrderItemResponse {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = null!;
        public string Sku { get; set; } = null!;
        public decimal UnitPrice { get; set; }
        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public byte IsGift { get; set; }
    }
}
