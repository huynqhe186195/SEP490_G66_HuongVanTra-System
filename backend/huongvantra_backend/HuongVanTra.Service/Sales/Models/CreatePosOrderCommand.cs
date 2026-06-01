namespace HuongVanTra.Service.Sales.Models {
    public class CreatePosOrderCommand {
        public int StoreId { get; set; }
        public int CashierId { get; set; }
        public int? CustomerId { get; set; }
        public int? PromotionId { get; set; }
        public List<OrderItemCommand> Items { get; set; } = new();
        public List<PaymentCommand> Payments { get; set; } = new();
    }

    public class OrderItemCommand {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public byte IsGift { get; set; } = 0;
    }

    public class PaymentCommand {
        public string PaymentMethod { get; set; } = "CASH";
        public decimal Amount { get; set; }
    }
}
