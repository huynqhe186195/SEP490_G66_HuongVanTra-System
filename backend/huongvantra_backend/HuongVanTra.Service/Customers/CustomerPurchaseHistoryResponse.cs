namespace HuongVanTra.Service.Customers {
    public class CustomerPurchaseHistoryResponse {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public List<CustomerPurchaseHistoryItemResponse> Orders { get; set; } = new();
    }

    public class CustomerPurchaseHistoryItemResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = null!;
        public string StockStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public int ItemCount { get; set; }
        public List<CustomerPurchaseHistoryOrderItemResponse> Items { get; set; } = new();
    }

    public class CustomerPurchaseHistoryOrderItemResponse {
        public int ProductId { get; set; }
        public string? ProductSku { get; set; }
        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public bool IsGift { get; set; }
    }
}
