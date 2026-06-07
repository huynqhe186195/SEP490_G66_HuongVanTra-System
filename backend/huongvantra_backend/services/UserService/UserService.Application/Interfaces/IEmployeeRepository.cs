using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IEmployeeRepository
{
    Task<Employee?> GetByUserIdAsync(Guid userId);
    Task<Employee?> GetByIdAsync(long id);
    Task<(IEnumerable<Employee> Items, int TotalCount)> GetAllAsync(int page, int pageSize);
    Task AddAsync(Employee employee);
    void Update(Employee employee);
    Task SaveChangesAsync();
}
