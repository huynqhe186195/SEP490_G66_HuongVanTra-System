using UserService.Domain.Enums;

namespace UserService.Domain.Entities;

public class Employee : BaseEntity
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public decimal ActualSalary { get; set; }
    public string? PhoneNumber { get; set; }
    public string? BankAccountInfo { get; set; }
    public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;

    public User User { get; set; } = null!;
}
