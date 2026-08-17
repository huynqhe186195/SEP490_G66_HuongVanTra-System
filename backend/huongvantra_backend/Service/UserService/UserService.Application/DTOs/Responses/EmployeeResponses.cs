namespace UserService.Application.DTOs.Responses;

public record EmployeeDetailResponse(
    long Id,
    Guid UserId,
    string Username,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? PhoneNumber,
    string? BankAccountInfo,
    string Status,
    bool IsUserActive,
    List<string> Roles);

public record SalesAssigneeResponse(
    Guid UserId,
    string FullName,
    string? Department);
