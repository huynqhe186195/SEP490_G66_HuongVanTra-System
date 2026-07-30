namespace UserService.Application.DTOs.Requests;

public record LoginRequest(string Username, string Password);

public record RefreshTokenRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record AuthChangePasswordRequest(string CurrentPassword, string NewPassword);

public record ResetPasswordRequest(string Username, string NewPassword);

public record UpdateMyProfileRequest(
    string FullName,
    string? Phone,
    string? Note);
