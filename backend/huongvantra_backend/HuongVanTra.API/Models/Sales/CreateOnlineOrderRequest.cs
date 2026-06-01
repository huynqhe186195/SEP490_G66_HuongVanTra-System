namespace HuongVanTra.API.Models.Sales {
    public class CreateOnlineOrderRequest {
        public int StoreId { get; set; }
        public int? CustomerId { get; set; }
        public int? PromotionId { get; set; }
        public string PaymentMethod { get; set; } = null!; // "VIETQR" | "COD"
        public string? ShippingAddress { get; set; }
        public List<OrderItemRequest> Items { get; set; } = new();
        public List<PaymentRequest> Payments { get; set; } = new();
    }
}
