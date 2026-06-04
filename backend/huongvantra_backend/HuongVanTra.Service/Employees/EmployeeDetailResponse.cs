namespace HuongVanTra.Service.Employees {
    public class EmployeeDetailResponse {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int StoreId { get; set; }
        public string Status { get; set; } = null!;
        public EmployeeUserAccountResponse? UserAccount { get; set; }
        public List<string> Roles { get; set; } = new();
    }

    public class EmployeeUserAccountResponse {
        public int UserId { get; set; }
        public string Username { get; set; } = null!;
        public bool IsActive { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }
    }
}
