namespace HuongVanTra.API.Models.Auth {
    public class CurrentUserResponse {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public int EmployeeId { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }
        public List<string> Roles { get; set; } = new();
    }
}
