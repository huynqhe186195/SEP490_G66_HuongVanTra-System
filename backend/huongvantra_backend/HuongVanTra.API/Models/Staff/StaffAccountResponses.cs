namespace HuongVanTra.API.Models.Staff {
    public class StaffAccountListItemResponse {
        public int UserId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; }
        public string EmployeeStatus { get; set; } = string.Empty;
        public int StoreId { get; set; }
        public string? StoreName { get; set; }
        public List<string> Roles { get; set; } = new();
        public DateTime? LastLoginAtUtc { get; set; }
    }

    public class StaffAccountDetailResponse : StaffAccountListItemResponse {
        public string? Note { get; set; }
        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
    }

    public class RoleOptionResponse {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
