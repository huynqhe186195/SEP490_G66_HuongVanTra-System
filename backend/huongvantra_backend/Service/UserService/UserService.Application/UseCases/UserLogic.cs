using UserService.Application.Authorization;
using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Application.Validation;
using UserService.Domain.Constants;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class UserLogic(IUserRepository userRepo, IRoleRepository roleRepo, IEmployeeRepository employeeRepo)
{
    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var roleIds = UserInputValidator.ResolveRoleIds(request.RoleIds, request.RoleId);
        UserInputValidator.ValidatePhoneIfProvided(request.BankAccountInfo);

        if (await userRepo.ExistsAsync(request.Username))
            throw new DuplicateUsernameException(request.Username);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true
        };

        var assignedRoles = new List<Role>();
        foreach (var roleId in roleIds)
        {
            var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            assignedRoles.Add(role);
        }
        RoleAssignmentRules.Replace(user, assignedRoles);

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

        return await GetByIdAsync(user.Id);
    }

    public async Task<PagedResult<UserResponse>> GetAllAsync(int page, int pageSize, bool onlyDeleted = false)
    {
        var (items, totalCount) = await userRepo.GetAllAsync(page, pageSize, onlyDeleted);
        return new PagedResult<UserResponse>(
            items.Select(MapToResponse),
            page,
            pageSize,
            totalCount);
    }

    public async Task<PagedResult<UserResponse>> GetAllAccessibleAsync(
        int page,
        int pageSize,
        IReadOnlyList<string> actorPermissions,
        bool onlyDeleted = false)
    {
        var (items, _) = await userRepo.GetAllAsync(1, 500, onlyDeleted);
        IEnumerable<User> filtered = items;

        if (StaffManagementScope.IsBranchManager(actorPermissions))
        {
            filtered = items.Where(user =>
                StaffManagementScope.CanViewEmployee(
                    actorPermissions,
                    user.UserRoles.Select(ur => ur.Role.RoleName)));
        }
        else if (actorPermissions.Contains(PermissionNames.ViewAllCustomers, StringComparer.Ordinal))
        {
            filtered = items.Where(user => user.IsActive && !user.IsDeleted);
        }
        else
        {
            filtered = [];
        }

        var list = filtered.ToList();
        var paged = list
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToResponse)
            .ToList();

        return new PagedResult<UserResponse>(paged, page, pageSize, list.Count);
    }

    public async Task<UserResponse> GetByIdAsync(Guid id)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        return MapToResponse(user);
    }

    public async Task<UserResponse> UpdateMyProfileAsync(Guid userId, UpdateMyProfileRequest request)
    {
        var fullName = (request.FullName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fullName))
            throw new UserValidationException("Họ và tên không được để trống.");
        if (fullName.Length > 200)
            throw new UserValidationException("Họ và tên không được vượt quá 200 ký tự.");

        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > 500 })
            throw new UserValidationException("Ghi chú không được vượt quá 500 ký tự.");

        UserInputValidator.ValidatePhoneIfProvided(phone);

        var user = await userRepo.GetByIdAsync(userId) ?? throw new UserNotFoundException(userId);
        var employee = user.Employee ?? await employeeRepo.GetByUserIdAsync(userId);
        if (employee is null)
            throw new UserValidationException("Tài khoản chưa có hồ sơ nhân viên để cập nhật.");

        employee.FullName = fullName;
        employee.BankAccountInfo = phone;
        employee.Department = note;
        employee.UpdatedAt = DateTime.UtcNow;
        employeeRepo.Update(employee);
        await employeeRepo.SaveChangesAsync();

        return await GetByIdAsync(userId);
    }

    public async Task<UserResponse> GetByIdAsync(Guid id, IReadOnlyList<string> actorPermissions)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        EnforceStaffScopeIfNeeded(actorPermissions, user.UserRoles.Select(ur => ur.Role.RoleName));
        return MapToResponse(user);
    }

    public async Task UpdateAsync(Guid id, UpdateUserRequest request, IReadOnlyList<string>? actorPermissions = null)
    {
        var roleIds = UserInputValidator.ResolveRoleIds(request.RoleIds, request.RoleId);

        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        var currentRoles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList();

        var assignedRoles = new List<Role>();
        foreach (var roleId in roleIds)
        {
            var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            assignedRoles.Add(role);
        }

        EnforceStaffScopeIfNeeded(
            actorPermissions,
            currentRoles,
            assignedRoles.Select(r => r.RoleName));

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        RoleAssignmentRules.Replace(user, assignedRoles);

        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task LockAsync(Guid id, IReadOnlyList<string>? actorPermissions = null)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        EnforceStaffScopeIfNeeded(
            actorPermissions,
            user.UserRoles.Select(ur => ur.Role.RoleName));
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task UnlockAsync(Guid id, IReadOnlyList<string>? actorPermissions = null)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        EnforceStaffScopeIfNeeded(
            actorPermissions,
            user.UserRoles.Select(ur => ur.Role.RoleName));
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task SoftDeleteAsync(Guid id)
    {
        _ = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        await userRepo.SoftDeleteAsync(id);
    }

    public async Task RestoreAsync(Guid id)
    {
        await userRepo.RestoreAsync(id);
        _ = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
    }

    public async Task ChangePasswordAsync(Guid id, ChangePasswordRequest request)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new InvalidCredentialsException();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task AssignRolesAsync(Guid id, AssignRolesRequest request, IReadOnlyList<string>? actorPermissions = null)
    {
        var roleIds = UserInputValidator.ResolveRoleIds(request.RoleIds, request.RoleId);
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);

        var assignedRoles = new List<Role>();
        foreach (var roleId in roleIds)
        {
            var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            assignedRoles.Add(role);
        }

        EnforceStaffScopeIfNeeded(
            actorPermissions,
            user.UserRoles.Select(ur => ur.Role.RoleName),
            assignedRoles.Select(r => r.RoleName));

        var existingRoles = user.UserRoles
            .Select(userRole => userRole.Role)
            .Where(role => role is not null)
            .Concat(assignedRoles);
        RoleAssignmentRules.Replace(user, existingRoles);

        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task RevokeRoleAsync(Guid userId, int roleId)
    {
        var user = await userRepo.GetByIdAsync(userId) ?? throw new UserNotFoundException(userId);
        var userRole = user.UserRoles.FirstOrDefault(ur => ur.RoleId == roleId)
            ?? throw new RoleNotFoundException(roleId);

        user.UserRoles.Remove(userRole);
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task<IEnumerable<RoleSummaryResponse>> GetRolesAsync(Guid id)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        return MapUserRoles(user);
    }

    public async Task<IEnumerable<RoleSummaryResponse>> GetRolesAsync(Guid id, IReadOnlyList<string> actorPermissions)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        EnforceStaffScopeIfNeeded(actorPermissions, user.UserRoles.Select(ur => ur.Role.RoleName));
        return MapUserRoles(user);
    }

    public async Task<IReadOnlyList<LegacySaleReviewResponse>> GetLegacySaleReviewAsync()
    {
        var users = await userRepo.GetLegacySaleUsersAsync();
        return users
            .Select(user => new LegacySaleReviewResponse(
                user.Id,
                user.Username,
                user.Employee?.Id,
                user.UserRoles
                    .Select(userRole => userRole.Role.RoleName)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(roleName => roleName, StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                "Không đủ dữ liệu để xác định tài khoản này phải là SalePos hay SaleCod; giữ quyền Sale legacy an toàn tương đương SalePos và cần quản trị viên xác nhận."))
            .ToList();
    }

    private static void EnforceStaffScopeIfNeeded(
        IReadOnlyList<string>? actorPermissions,
        IEnumerable<string> employeeRoles,
        IEnumerable<string>? assignedRoleNames = null)
    {
        if (actorPermissions is null
            || StaffManagementScope.HasFullUserManagement(actorPermissions)
            || StaffManagementScope.IsSystemAdmin(actorPermissions))
        {
            return;
        }

        StaffManagementScope.EnsureCanManageEmployee(actorPermissions, employeeRoles);
        if (assignedRoleNames is not null)
            StaffManagementScope.EnsureCanAssignRoles(actorPermissions, assignedRoleNames);
    }

    private static IEnumerable<RoleSummaryResponse> MapUserRoles(User user) =>
        user.UserRoles.Select(ur => new RoleSummaryResponse(
            ur.Role.Id,
            ur.Role.RoleName,
            ur.Role.Description));

    private static UserResponse MapToResponse(User user) => new(
        user.Id,
        user.Username,
        user.IsActive,
        user.IsDeleted,
        user.LastLoginAt,
        user.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
        user.Employee is null ? null : new EmployeeResponse(
            user.Employee.Id,
            user.Employee.FullName,
            user.Employee.Department,
            user.Employee.ActualSalary,
            user.Employee.BankAccountInfo,
            user.Employee.Status.ToString()));
}
