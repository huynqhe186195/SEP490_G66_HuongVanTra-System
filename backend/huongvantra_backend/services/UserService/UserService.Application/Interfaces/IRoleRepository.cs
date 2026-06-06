using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(int id);
    Task<IEnumerable<Role>> GetAllAsync();
    Task<IEnumerable<Role>> GetByUserIdAsync(Guid userId);
    Task AddAsync(Role role);
    void Update(Role role);
    Task SaveChangesAsync();
}
