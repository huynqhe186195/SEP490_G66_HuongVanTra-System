using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Customers {
    public class Customer {
        public int Id { get; set; }
        public string CustomerCode { get; set; } = null!;

        public string CustomerType { get; set; } = "RETAIL";

        public string? Phone { get; set; }

        public int? TierId { get; set; }
        public int? AssignedEmployeeId { get; set; }

        public decimal TotalSpend { get; set; } = 0;

        public MembershipTier? Tier { get; set; }
        public Employee? AssignedEmployee { get; set; }
    }
}