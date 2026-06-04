using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Customers {
    public class Customer {
        public int Id { get; set; }
        public string CustomerCode { get; set; } = null!;
        public string FullName { get; set; } = null!;

        public string CustomerType { get; set; } = "RETAIL";

        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string Status { get; set; } = "ACTIVE";

        public int? TierId { get; set; }
        public int? AssignedEmployeeId { get; set; }

        public decimal TotalSpend { get; set; } = 0;
        public decimal CurrentDebt { get; set; } = 0;

        public MembershipTier? Tier { get; set; }
        public Employee? AssignedEmployee { get; set; }
    }
}
