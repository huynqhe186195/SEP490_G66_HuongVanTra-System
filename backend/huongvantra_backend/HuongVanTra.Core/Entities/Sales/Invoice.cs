using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Sales {
    public class Invoice {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string InvoiceCode { get; set; } = null!;
        public DateTime InvoiceDate { get; set; }
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = "paid";
        public int? IssuedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public Order Order { get; set; } = null!;
        public Employee? IssuedBy { get; set; }
    }
}
