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
}
