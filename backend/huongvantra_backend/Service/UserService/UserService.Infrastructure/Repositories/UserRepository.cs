using Microsoft.EntityFrameworkCore;
using UserService.Application.Authorization;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class UserRepository(UserDbContext context) : IUserRepository
{
    public async Task<User?> GetByIdAsync(Guid id) =>
        await context.Users
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

    public async Task<User?> GetByUsernameAsync(string username) =>
        await context.Users
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Username == username && !u.IsDeleted);

    public async Task<User?> GetByEmployeePhoneAsync(string phoneDigits)
    {
        if (string.IsNullOrWhiteSpace(phoneDigits))
            return null;

        var candidates = await context.Users
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Where(u =>
                !u.IsDeleted
                && u.IsActive
                && u.Employee != null
                && u.Employee.BankAccountInfo != null
                && u.Employee.BankAccountInfo != "")
            .ToListAsync();

        return candidates.FirstOrDefault(u =>
            NormalizePhoneDigits(u.Employee!.BankAccountInfo) == phoneDigits);
    }

    private static string NormalizePhoneDigits(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;
        return new string(value.Where(char.IsDigit).ToArray());
    }

    public async Task<IReadOnlyList<User>> GetLegacySaleUsersAsync() =>
        await context.Users
            .AsNoTracking()
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Where(u =>
                !u.IsDeleted
                && u.UserRoles.Any(ur =>
                    !ur.Role.IsDeleted
                    && ur.Role.RoleName == StaffManagementScope.SaleRoleName))
            .OrderBy(u => u.Username)
            .ToListAsync();

    public async Task<bool> ExistsAsync(string username) =>
        await context.Users.AnyAsync(u => u.Username == username && !u.IsDeleted);

    public async Task<(IEnumerable<User> Items, int TotalCount)> GetAllAsync(int page, int pageSize, bool onlyDeleted = false)
    {
        var query = context.Users
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Where(u => u.IsDeleted == onlyDeleted);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task AddAsync(User user) => await context.Users.AddAsync(user);

    public void Update(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        context.Users.Update(user);
    }

    public async Task SoftDeleteAsync(Guid id)
    {
        var user = await context.Users
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);
        if (user is null) return;

        user.IsDeleted = true;
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        if (user.Employee is not null)
        {
            user.Employee.IsDeleted = true;
            user.Employee.Status = EmployeeStatus.Inactive;
            user.Employee.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    public async Task RestoreAsync(Guid id)
    {
        var user = await context.Users
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == id && u.IsDeleted);
        if (user is null) return;

        user.IsDeleted = false;
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;

        if (user.Employee is not null)
        {
            user.Employee.IsDeleted = false;
            user.Employee.Status = EmployeeStatus.Active;
            user.Employee.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
