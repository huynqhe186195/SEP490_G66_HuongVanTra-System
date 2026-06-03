namespace HuongVanTra.Service.Orders {
    public class OrderQuery {
        public string? Search { get; set; }
        public string? OrderStatus { get; set; }
        public string? PaymentStatus { get; set; }
        public string? PaymentMethod { get; set; }
        public int? CashierId { get; set; }
        public OrderAccessScope Access { get; set; } = OrderAccessScope.AllOrders();
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
