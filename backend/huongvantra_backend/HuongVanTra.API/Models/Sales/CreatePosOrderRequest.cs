namespace HuongVanTra.API.Models.Sales {
    public class CreatePosOrderRequest {
        public int StoreId { get; set; }
        public int CustomerId { get; set; }
        public int? PromotionId { get; set; }
        public List<OrderItemRequest> Items { get; set; } = new();
        public List<PaymentRequest> Payments { get; set; } = new();
    }

    public class OrderItemRequest {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public byte IsGift { get; set; } = 0;
    }

    public class PaymentRequest {
        public string PaymentMethod { get; set; } = "CASH";
        public decimal Amount { get; set; }
    }
}
