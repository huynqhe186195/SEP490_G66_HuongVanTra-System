namespace HuongVanTra.Service.Users {
    public class CreateUserRequest {
        public int EmployeeId { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public List<int>? RoleIds { get; set; }
    }
}
