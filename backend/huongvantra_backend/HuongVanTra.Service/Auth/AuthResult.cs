namespace HuongVanTra.Service.Auth {
    public class AuthResult {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime RefreshTokenExpiresAtUtc { get; set; }
    }
}
