namespace HuongVanTra.Service.Customers {
    public class CustomerListItemResponse {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string CustomerType { get; set; } = null!;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string Status { get; set; } = null!;
        public int? TierId { get; set; }
        public string? TierCode { get; set; }
        public decimal TierDiscountPercent { get; set; }
        public int? AssignedEmployeeId { get; set; }
        public string? AssignedEmployeeName { get; set; }
        public decimal TotalSpend { get; set; }
        public decimal CurrentDebt { get; set; }
    }
}
