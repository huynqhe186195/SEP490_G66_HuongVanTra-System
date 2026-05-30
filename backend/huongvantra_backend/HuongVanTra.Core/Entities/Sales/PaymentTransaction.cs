using System;

namespace HuongVanTra.Core.Entities.Sales {
    public class PaymentTransaction {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string PaymentMethod { get; set; } = "CASH";
        public decimal Amount { get; set; }
        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

        public Order Order { get; set; } = null!;
    }
}