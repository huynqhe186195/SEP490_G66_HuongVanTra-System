namespace HuongVanTra.Core.Entities.Identity {
    public class User {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string Username { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public byte IsActive { get; set; } = 1;
        public DateTime? LastLoginAt { get; set; }

        public Employee Employee { get; set; } = null!;
    }
}