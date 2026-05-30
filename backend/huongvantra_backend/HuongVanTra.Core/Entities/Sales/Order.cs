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

        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = "UNPAID";
        public string StockStatus { get; set; } = "PENDING";
        public string OrderStatus { get; set; } = "COMPLETED";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Store Store { get; set; } = null!;
        public Customer? Customer { get; set; }
        public Employee Cashier { get; set; } = null!;
        public OrderPromotion? Promotion { get; set; }

        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();

        public StockDeductQueue? StockDeductQueue { get; set; }
    }
}