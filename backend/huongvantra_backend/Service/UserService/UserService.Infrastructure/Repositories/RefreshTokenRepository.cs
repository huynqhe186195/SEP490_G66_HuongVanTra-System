using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class RefreshTokenRepository(UserDbContext context) : IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetByTokenAsync(string token) =>
        await context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == token);

    public async Task AddAsync(RefreshToken refreshToken) =>
        await context.RefreshTokens.AddAsync(refreshToken);

    public void Update(RefreshToken refreshToken) => context.RefreshTokens.Update(refreshToken);

    public async Task RevokeAllForUserAsync(Guid userId)
    {
        var tokens = await context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync();

        foreach (var token in tokens)
            token.IsRevoked = true;
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
