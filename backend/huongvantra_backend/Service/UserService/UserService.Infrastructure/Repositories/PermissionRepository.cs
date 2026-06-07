using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class PermissionRepository(UserDbContext context) : IPermissionRepository
{
    public async Task<Permission?> GetByIdAsync(int id) =>
        await context.Permissions.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

    public async Task<Permission?> GetByNameAsync(string name) =>
        await context.Permissions.FirstOrDefaultAsync(p => p.PermissionName == name && !p.IsDeleted);

    public async Task<IEnumerable<Permission>> GetAllAsync(bool onlyDeleted = false) =>
        await context.Permissions
            .Where(p => p.IsDeleted == onlyDeleted)
            .OrderBy(p => p.PermissionName)
            .ToListAsync();

    public async Task AddAsync(Permission permission) => await context.Permissions.AddAsync(permission);

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();

    public async Task SoftDeleteAsync(int id)
    {
        var permission = await context.Permissions.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (permission is null) return;

        permission.IsDeleted = true;
        permission.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task RestoreAsync(int id)
    {
        var permission = await context.Permissions.FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
        if (permission is null) return;

        permission.IsDeleted = false;
        permission.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }
}
