namespace HuongVanTra.Service.Auth {
    public interface IAuthService {
        Task<AuthResult?> LoginAsync(string username, string password);
        Task<AuthResult?> RefreshAsync(string accessToken, string refreshToken);
        Task<bool> LogoutAsync(string refreshToken, int currentUserId);
        Task<CurrentUserResult?> GetCurrentUserAsync(int userId);
    }
}
