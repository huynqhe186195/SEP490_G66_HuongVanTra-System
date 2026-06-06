namespace UserService.Application.DTOs.Requests;

public record LoginRequest(string Username, string Password);

public record CreateUserRequest(
    string Username,
    string Password,
    List<int> RoleIds,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo);

public record UpdateUserRequest(
    bool IsActive,
    List<int> RoleIds);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);
