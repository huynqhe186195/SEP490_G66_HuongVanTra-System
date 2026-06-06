using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IEmployeeRepository
{
    Task<Employee?> GetByUserIdAsync(Guid userId);
    Task<Employee?> GetByIdAsync(long id);
    Task<IEnumerable<Employee>> GetAllAsync();
    Task AddAsync(Employee employee);
    void Update(Employee employee);
    Task SaveChangesAsync();
}
