using UserService.Application.Authorization;
using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Application.Validation;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class EmployeeLogic(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    IEmployeeRepository employeeRepo)
{
    public async Task<EmployeeDetailResponse> CreateAsync(
        CreateEmployeeRequest request,
        IReadOnlyList<string>? actorPermissions = null)
    {
        UserInputValidator.ValidateSingleRole(request.RoleIds);
        UserInputValidator.ValidatePhoneIfProvided(request.BankAccountInfo);

        if (await userRepo.ExistsAsync(request.Username))
            throw new DuplicateUsernameException(request.Username);

        var assignedRoles = new List<Role>();
        foreach (var roleId in request.RoleIds)
        {
            var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            assignedRoles.Add(role);
        }

        if (actorPermissions is not null)
            StaffManagementScope.EnsureCanAssignRoles(actorPermissions, assignedRoles.Select(r => r.RoleName));

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true
        };

        foreach (var role in assignedRoles)
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });

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

    public async Task<PagedResult<EmployeeDetailResponse>> GetAllAsync(
        int page,
        int pageSize,
        IReadOnlyList<string>? actorPermissions = null)
    {
        var (items, _) = await employeeRepo.GetAllAsync(1, 500);
        var visible = items
            .Select(MapToDetail)
            .Where(employee => actorPermissions is null
                || StaffManagementScope.CanViewEmployee(actorPermissions, employee.Roles))
            .ToList();

        var paged = visible
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PagedResult<EmployeeDetailResponse>(
            paged,
            page,
            pageSize,
            visible.Count);
    }

    public async Task<IReadOnlyList<SalesAssigneeResponse>> GetSalesAssigneesAsync()
    {
        var (items, _) = await employeeRepo.GetAllAsync(1, 500);
        return items
            .Select(MapToDetail)
            .Where(employee =>
                employee.IsUserActive
                && string.Equals(employee.Status, EmployeeStatus.Active.ToString(), StringComparison.OrdinalIgnoreCase)
                && employee.Roles.Any(StaffManagementScope.IsSaleRole))
            .Select(employee => new SalesAssigneeResponse(
                employee.UserId,
                employee.FullName,
                employee.Department))
            .OrderBy(employee => employee.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<EmployeeDetailResponse> GetByIdAsync(long id, IReadOnlyList<string>? actorPermissions = null)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);
        var response = MapToDetail(employee);
        if (actorPermissions is not null)
            StaffManagementScope.EnsureCanManageEmployee(actorPermissions, response.Roles);
        return response;
    }

    public async Task UpdateAsync(long id, UpdateEmployeeRequest request, IReadOnlyList<string>? actorPermissions = null)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);
        if (actorPermissions is not null)
            StaffManagementScope.EnsureCanManageEmployee(actorPermissions, GetRoleNames(employee));

        employee.FullName = request.FullName;
        employee.Department = request.Department;
        employee.ActualSalary = request.ActualSalary;
        employee.BankAccountInfo = request.BankAccountInfo;
        employee.UpdatedAt = DateTime.UtcNow;

        employeeRepo.Update(employee);
        await employeeRepo.SaveChangesAsync();
    }

    public async Task DeactivateAsync(long id, IReadOnlyList<string>? actorPermissions = null)
    {
        var employee = await employeeRepo.GetByIdAsync(id) ?? throw new EmployeeNotFoundException(id);
        if (actorPermissions is not null)
            StaffManagementScope.EnsureCanManageEmployee(actorPermissions, GetRoleNames(employee));

        employee.Status = EmployeeStatus.Inactive;
        employee.UpdatedAt = DateTime.UtcNow;
        employeeRepo.Update(employee);

        var user = await userRepo.GetByIdAsync(employee.UserId) ?? throw new UserNotFoundException(employee.UserId);
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);

        await employeeRepo.SaveChangesAsync();
    }

    private static List<string> GetRoleNames(Employee employee) =>
        employee.User?.UserRoles?
            .Select(ur => ur.Role?.RoleName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

    private static EmployeeDetailResponse MapToDetail(Employee employee)
    {
        var roles = employee.User?.UserRoles?
            .Select(ur => ur.Role?.RoleName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!)
            .Distinct()
            .ToList() ?? [];

        return new EmployeeDetailResponse(
            employee.Id,
            employee.UserId,
            employee.User?.Username ?? string.Empty,
            employee.FullName,
            employee.Department,
            employee.ActualSalary,
            employee.BankAccountInfo,
            employee.Status.ToString(),
            employee.User?.IsActive ?? false,
            roles);
    }
}
