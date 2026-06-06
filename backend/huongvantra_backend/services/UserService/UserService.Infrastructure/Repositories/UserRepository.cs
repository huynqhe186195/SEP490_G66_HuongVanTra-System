using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
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
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Username == username && !u.IsDeleted);

    public async Task<bool> ExistsAsync(string username) =>
        await context.Users.AnyAsync(u => u.Username == username && !u.IsDeleted);

    public async Task AddAsync(User user) => await context.Users.AddAsync(user);

    public void Update(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        context.Users.Update(user);
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
