namespace HuongVanTra.API.Models.Auth {
    public class UserAccessResponse {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
        public List<string> Modules { get; set; } = new();
    }
}
