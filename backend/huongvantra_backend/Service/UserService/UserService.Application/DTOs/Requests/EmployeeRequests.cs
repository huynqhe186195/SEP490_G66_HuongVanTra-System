namespace UserService.Application.DTOs.Requests;

public record CreateEmployeeRequest(
    string Username,
    string Password,
    List<int>? RoleIds,
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo,
    int? RoleId = null);

public record UpdateEmployeeRequest(
    string FullName,
    string? Department,
    decimal ActualSalary,
    string? BankAccountInfo);
