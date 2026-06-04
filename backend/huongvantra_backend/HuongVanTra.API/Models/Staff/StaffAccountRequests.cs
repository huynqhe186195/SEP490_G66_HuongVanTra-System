namespace HuongVanTra.API.Models.Staff {
    public class UpdateStaffAccountRequest {
        public string? FullName { get; set; }
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public string? Username { get; set; }
        public bool? IsActive { get; set; }
        public string? NewPassword { get; set; }
    }

    public class AssignStaffRolesRequest {
        public List<string> Roles { get; set; } = new();
    }

    public class CreateStaffAccountRequest {
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public bool IsActive { get; set; } = true;
        public int? StoreId { get; set; }
        public int? DepartmentId { get; set; }
        public List<string> Roles { get; set; } = new();
    }
}
