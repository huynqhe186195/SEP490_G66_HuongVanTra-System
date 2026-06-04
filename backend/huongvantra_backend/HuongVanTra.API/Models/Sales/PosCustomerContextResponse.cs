namespace HuongVanTra.API.Models.Sales {
    public class PosCustomerContextResponse {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string CustomerType { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? TierCode { get; set; }
        public int? TierId { get; set; }
        public decimal TierDiscountPercent { get; set; }
        public decimal TotalSpend { get; set; }
        /// <summary>Tổng công nợ lưu trên khách (customers.CurrentDebt).</summary>
        public decimal CurrentDebt { get; set; }
        /// <summary>Còn phải thu theo từng đơn (tính từ orders chưa paid).</summary>
        public decimal OutstandingBalance { get; set; }
        public List<PosCustomerOrderHistoryItemResponse> RecentOrders { get; set; } = new();
        public List<PosCustomerDebtOrderItemResponse> UnpaidOrders { get; set; } = new();
        public List<PosCustomerShippingAddressResponse> ShippingAddresses { get; set; } = new();
    }

    public class PosCustomerShippingAddressResponse {
        public string Address { get; set; } = string.Empty;
        public DateTime? LastUsedAt { get; set; }
        public bool IsProfileAddress { get; set; }
    }

    public class PosCustomerOrderHistoryItemResponse {
        public string OrderCode { get; set; } = string.Empty;
        public string EntryType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = string.Empty;
        public string CashierName { get; set; } = string.Empty;
        public string CashierRole { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class PosCustomerDebtOrderItemResponse {
        public string OrderCode { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal RemainingAmount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
