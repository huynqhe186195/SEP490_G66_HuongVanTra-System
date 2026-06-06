namespace UserService.Application.DTOs.Responses;

public record LoginResponse(string AccessToken, string Username, List<string> Roles, List<string> Permissions);

public record UserResponse(
    Guid Id,
    string Username,
    bool IsActive,
    DateTime? LastLoginAt,
    List<string> Roles,
    EmployeeResponse? Employee);

public record EmployeeResponse(
    long Id,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo);
