namespace UserService.Application.DTOs.Responses;

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string Username,
    List<string> Roles,
    List<string> Permissions);

public record UserResponse(
    Guid Id,
    string Username,
    bool IsActive,
    bool IsDeleted,
    DateTime? LastLoginAt,
    List<string> Roles,
    EmployeeResponse? Employee);

public record EmployeeResponse(
    long Id,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo,
    string Status);

public record PagedResult<T>(
    IEnumerable<T> Items,
    int Page,
    int PageSize,
    int TotalCount);

public record RoleSummaryResponse(int Id, string RoleName, string? Description);
