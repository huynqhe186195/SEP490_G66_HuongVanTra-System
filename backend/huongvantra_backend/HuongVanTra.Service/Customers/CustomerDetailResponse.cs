namespace HuongVanTra.Service.Customers {
    public class CustomerDetailResponse {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string CustomerType { get; set; } = null!;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string Status { get; set; } = null!;
        public CustomerTierResponse? Tier { get; set; }
        public CustomerAssignedEmployeeResponse? AssignedEmployee { get; set; }
        public decimal TotalSpend { get; set; }
        public decimal CurrentDebt { get; set; }
    }

    public class CustomerTierResponse {
        public int TierId { get; set; }
        public string TierCode { get; set; } = null!;
        public decimal MinTotalSpend { get; set; }
        public decimal DiscountPercent { get; set; }
    }

    public class CustomerAssignedEmployeeResponse {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}
