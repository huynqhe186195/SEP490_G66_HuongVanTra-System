using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Customers {
    public class MembershipTier {
        public int Id { get; set; }
        public string TierCode { get; set; } = null!;
        public decimal MinTotalSpend { get; set; }
        public decimal DiscountPercent { get; set; }
        public bool IsActive { get; set; } = true;

        public ICollection<Customer> Customers { get; set; } = new List<Customer>();
    }
}