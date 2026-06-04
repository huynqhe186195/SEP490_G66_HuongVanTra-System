namespace HuongVanTra.API.Models.Sales {
    public class CreateOnlineOrderRequest {
        public int StoreId { get; set; }
        public int? CustomerId { get; set; }
        public int? PromotionId { get; set; }
        public decimal ManualDiscount { get; set; }
        public string? PaymentMethod { get; set; }
        public string? ShippingAddress { get; set; }
        public List<OrderItemRequest> Items { get; set; } = new();
        public List<PaymentRequest> Payments { get; set; } = new();
    }
}
