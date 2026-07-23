namespace UserService.Application.DTOs.Requests;

public record CreateUserRequest(
    string Username,
    string Password,
    List<int>? RoleIds,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo,
    int? RoleId = null);

public record UpdateUserRequest(
    bool IsActive,
    List<int>? RoleIds,
    int? RoleId = null);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public record AssignRolesRequest(List<int>? RoleIds, int? RoleId = null);
