using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Sales {
    public class OrderPromotion {
        public int Id { get; set; }
        public string PromoCode { get; set; } = null!;
        public string DiscountType { get; set; } = "PERCENTAGE";
        public decimal DiscountValue { get; set; }

        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}