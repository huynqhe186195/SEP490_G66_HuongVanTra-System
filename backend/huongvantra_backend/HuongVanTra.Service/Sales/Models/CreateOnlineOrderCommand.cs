namespace HuongVanTra.Service.Sales.Models {
    public class CreateOnlineOrderCommand {
        public int StoreId { get; set; }
        public int CashierId { get; set; }
        public int? CustomerId { get; set; }
        public int? PromotionId { get; set; }
        public decimal ManualDiscount { get; set; }
        public string PaymentMethod { get; set; } = null!; // "VIETQR" | "COD"
        public string? ShippingAddress { get; set; }
        public List<OrderItemCommand> Items { get; set; } = new();
        public List<PaymentCommand> Payments { get; set; } = new();
    }
}
