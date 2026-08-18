using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(int id);
    Task<Role?> GetByIdIncludingDeletedAsync(int id);
    Task<bool> ExistsByNameAsync(string name, int? excludeId = null);
    Task<IEnumerable<Role>> GetAllAsync(bool onlyDeleted = false);
    Task<IEnumerable<Role>> GetByUserIdAsync(Guid userId);
    Task<bool> IsAssignedToUsersAsync(int roleId);
    Task AddAsync(Role role);
    void Update(Role role);
    Task SoftDeleteAsync(int id);
    Task RestoreAsync(int id);
    Task SaveChangesAsync();
}
