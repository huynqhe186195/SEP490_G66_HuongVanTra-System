using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
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
            BankAccountInfo = request.BankAccountInfo
        };
        await employeeRepo.AddAsync(employee);
        await userRepo.SaveChangesAsync();

        return await GetByIdAsync(user.Id);
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

    private static UserResponse MapToResponse(User user) => new(
        user.Id,
        user.Username,
        user.IsActive,
        user.LastLoginAt,
        user.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
        user.Employee is null ? null : new EmployeeResponse(
            user.Employee.Id,
            user.Employee.FullName,
            user.Employee.Department,
            user.Employee.ActualSalary,
            user.Employee.BankAccountInfo));
}
