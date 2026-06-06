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

    public async Task<IEnumerable<Role>> GetAllAsync() =>
        await context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .Where(r => !r.IsDeleted)
            .ToListAsync();

    public async Task<IEnumerable<Role>> GetByUserIdAsync(Guid userId) =>
        await context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Include(ur => ur.Role)
                .ThenInclude(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .Select(ur => ur.Role)
            .ToListAsync();

    public async Task AddAsync(Role role) => await context.Roles.AddAsync(role);

    public void Update(Role role)
    {
        role.UpdatedAt = DateTime.UtcNow;
        context.Roles.Update(role);
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
