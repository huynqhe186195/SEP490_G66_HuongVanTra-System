using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token);
    Task AddAsync(RefreshToken refreshToken);
    void Update(RefreshToken refreshToken);
    Task RevokeAllForUserAsync(Guid userId);
    Task SaveChangesAsync();
}
