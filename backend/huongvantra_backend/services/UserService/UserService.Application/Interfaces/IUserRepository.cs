using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByUsernameAsync(string username);
    Task<bool> ExistsAsync(string username);
    Task<(IEnumerable<User> Items, int TotalCount)> GetAllAsync(int page, int pageSize, bool onlyDeleted = false);
    Task AddAsync(User user);
    void Update(User user);
    Task SoftDeleteAsync(Guid id);
    Task RestoreAsync(Guid id);
    Task SaveChangesAsync();
}
