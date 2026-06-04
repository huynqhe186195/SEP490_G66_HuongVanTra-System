namespace HuongVanTra.API.Models.Profile {
    public class ProfileResponse {
        public int UserId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public int StoreId { get; set; }
        public string? StoreName { get; set; }
        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }
        public List<string> Roles { get; set; } = new();
    }
}
