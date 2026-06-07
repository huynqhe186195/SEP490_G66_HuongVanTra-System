using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class RoleRepository(UserDbContext context) : IRoleRepository
{
    public async Task<Role?> GetByIdAsync(int id) =>
        await context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

    public async Task<IEnumerable<Role>> GetAllAsync(bool onlyDeleted = false) =>
        await context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .Where(r => r.IsDeleted == onlyDeleted)
            .OrderBy(r => r.RoleName)
            .ToListAsync();

    public async Task<IEnumerable<Role>> GetByUserIdAsync(Guid userId) =>
        await context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Include(ur => ur.Role)
                .ThenInclude(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .Select(ur => ur.Role)
            .ToListAsync();

    public async Task<bool> IsAssignedToUsersAsync(int roleId) =>
        await context.UserRoles.AnyAsync(ur => ur.RoleId == roleId);

    public async Task AddAsync(Role role) => await context.Roles.AddAsync(role);

    public void Update(Role role)
    {
        role.UpdatedAt = DateTime.UtcNow;
        context.Roles.Update(role);
    }

    public async Task SoftDeleteAsync(int id)
    {
        var role = await context.Roles.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (role is null) return;

        role.IsDeleted = true;
        role.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task RestoreAsync(int id)
    {
        var role = await context.Roles.FirstOrDefaultAsync(r => r.Id == id && r.IsDeleted);
        if (role is null) return;

        role.IsDeleted = false;
        role.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
