using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class UserLogic(IUserRepository userRepo, IRoleRepository roleRepo, IEmployeeRepository employeeRepo)
{
    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
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

    public async Task<UserResponse> GetByIdAsync(Guid id)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        return MapToResponse(user);
    }

    public async Task UpdateAsync(Guid id, UpdateUserRequest request)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        user.UserRoles.Clear();

        foreach (var roleId in request.RoleIds)
        {
            _ = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
        }

        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task LockAsync(Guid id)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();
    }

    public async Task UnlockAsync(Guid id)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);
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

    public async Task AssignRolesAsync(Guid id, AssignRolesRequest request)
    {
        var user = await userRepo.GetByIdAsync(id) ?? throw new UserNotFoundException(id);

        foreach (var roleId in request.RoleIds)
        {
            if (user.UserRoles.Any(ur => ur.RoleId == roleId)) continue;
            _ = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
        }

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
        return user.UserRoles.Select(ur => new RoleSummaryResponse(
            ur.Role.Id,
            ur.Role.RoleName,
            ur.Role.Description));
    }

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
