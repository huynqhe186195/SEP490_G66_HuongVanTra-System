using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class EmployeeRepository(UserDbContext context) : IEmployeeRepository
{
    public async Task<Employee?> GetByUserIdAsync(Guid userId) =>
        await context.Employees.FirstOrDefaultAsync(e => e.UserId == userId && !e.IsDeleted);

    public async Task<Employee?> GetByIdAsync(long id) =>
        await context.Employees.FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);

    public async Task<IEnumerable<Employee>> GetAllAsync() =>
        await context.Employees.Where(e => !e.IsDeleted).ToListAsync();

    public async Task AddAsync(Employee employee) => await context.Employees.AddAsync(employee);

    public void Update(Employee employee)
    {
        employee.UpdatedAt = DateTime.UtcNow;
        context.Employees.Update(employee);
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
