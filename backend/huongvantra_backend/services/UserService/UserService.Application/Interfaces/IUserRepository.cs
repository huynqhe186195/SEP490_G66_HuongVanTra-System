using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByUsernameAsync(string username);
    Task<bool> ExistsAsync(string username);
    Task AddAsync(User user);
    void Update(User user);
    Task SaveChangesAsync();
}
