using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Stores;
using System;
using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Sales {
    public class Order {
        public int Id { get; set; }
        public string OrderCode { get; set; } = null!;
        public int StoreId { get; set; }
        public int? CustomerId { get; set; }
        public int CashierId { get; set; }
        public int? PromotionId { get; set; }

        public decimal SubTotal { get; set; }
        public decimal CouponDiscount { get; set; }
        public decimal ManualDiscount { get; set; }
        public decimal DeductAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Notes { get; set; }
        public string PaymentMethod { get; set; } = "CASH";
        public string PaymentStatus { get; set; } = "unpaid";
        public string StockStatus { get; set; } = "pending_deduct";
        public string OrderStatus { get; set; } = "confirmed";
        public string? ShippingAddress { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastRemindedAt { get; set; }

        public Store Store { get; set; } = null!;
        public Customer? Customer { get; set; }
        public Employee Cashier { get; set; } = null!;
        public OrderPromotion? Promotion { get; set; }

        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();

        public StockDeductQueue? StockDeductQueue { get; set; }
    }
}