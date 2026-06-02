namespace HuongVanTra.Service.Employees {
    public class EmployeeListItemResponse {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int StoreId { get; set; }
        public string Status { get; set; } = null!;
        public bool HasUserAccount { get; set; }
        public string? Username { get; set; }
    }
}
