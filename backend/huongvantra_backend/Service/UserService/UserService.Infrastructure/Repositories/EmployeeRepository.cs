using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class EmployeeRepository(UserDbContext context) : IEmployeeRepository
{
    public async Task<Employee?> GetByUserIdAsync(Guid userId) =>
        await context.Employees
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.UserId == userId && !e.IsDeleted);

    public async Task<Employee?> GetByIdAsync(long id) =>
        await context.Employees
            .Include(e => e.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);

    public async Task<(IEnumerable<Employee> Items, int TotalCount)> GetAllAsync(int page, int pageSize)
    {
        var query = context.Employees
            .Include(e => e.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
            .Where(e => !e.IsDeleted);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task AddAsync(Employee employee) => await context.Employees.AddAsync(employee);

    public void Update(Employee employee)
    {
        employee.UpdatedAt = DateTime.UtcNow;
        context.Employees.Update(employee);
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
