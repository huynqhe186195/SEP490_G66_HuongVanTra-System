namespace HuongVanTra.Service.Users {
    public class UserAccountResponse {
        public int UserId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Username { get; set; } = null!;
        public bool IsActive { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }
        public List<string> Roles { get; set; } = new();
    }
}
