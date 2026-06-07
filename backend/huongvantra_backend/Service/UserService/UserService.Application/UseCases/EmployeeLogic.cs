using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class EmployeeLogic(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    IEmployeeRepository employeeRepo)
{
    public async Task<EmployeeDetailResponse> CreateAsync(CreateEmployeeRequest request)
    {
        if (await userRepo.ExistsAsync(request.Username))
            throw new DuplicateUsernameException(request.Username);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true
        };

        foreach (var roleId in request.RoleIds)
        {
            _ = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
        }

        await userRepo.AddAsync(user);

        var employee = new Employee
        {
            UserId = user.Id,
            FullName = request.FullName,
            Department = request.Department,
            ActualSalary = request.ActualSalary,
            BankAccountInfo = request.BankAccountInfo,
            Status = EmployeeStatus.Active
        };

        await employeeRepo.AddAsync(employee);
        await userRepo.SaveChangesAsync();

        return await GetByIdAsync(employee.Id);
    }

    public async Task<PagedResult<EmployeeDetailResponse>> GetAllAsync(int page, int pageSize)
    {
        var (items, totalCount) = await employeeRepo.GetAllAsync(page, pageSize);
        return new PagedResult<EmployeeDetailResponse>(
            items.Select(MapToDetail),
            page,
            pageSize,
            totalCount);
    }

    public async Task<EmployeeDetailResponse> GetByIdAsync(long id)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);
        return MapToDetail(employee);
    }

    public async Task UpdateAsync(long id, UpdateEmployeeRequest request)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);

        employee.FullName = request.FullName;
        employee.Department = request.Department;
        employee.ActualSalary = request.ActualSalary;
        employee.BankAccountInfo = request.BankAccountInfo;
        employee.UpdatedAt = DateTime.UtcNow;

        employeeRepo.Update(employee);
        await employeeRepo.SaveChangesAsync();
    }

    public async Task DeactivateAsync(long id)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);

        employee.Status = EmployeeStatus.Inactive;
        employee.UpdatedAt = DateTime.UtcNow;
        employeeRepo.Update(employee);

        var user = await userRepo.GetByIdAsync(employee.UserId) ?? throw new UserNotFoundException(employee.UserId);
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);

        await employeeRepo.SaveChangesAsync();
    }

    private static EmployeeDetailResponse MapToDetail(Employee employee) => new(
        employee.Id,
        employee.UserId,
        employee.User?.Username ?? string.Empty,
        employee.FullName,
        employee.Department,
        employee.ActualSalary,
        employee.BankAccountInfo,
        employee.Status.ToString(),
        employee.User?.IsActive ?? false);
}
