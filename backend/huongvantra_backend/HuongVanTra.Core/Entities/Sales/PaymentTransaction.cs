namespace HuongVanTra.Core.Entities.Sales {
    public class PaymentTransaction {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string PaymentMethod { get; set; } = "CASH";
        public decimal Amount { get; set; }
        public string Status { get; set; } = "pending";
        public string? ReferenceCode { get; set; }
        public string? Note { get; set; }
        public int? ConfirmedById { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

        public Order Order { get; set; } = null!;
    }
}