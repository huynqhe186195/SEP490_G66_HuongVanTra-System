using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class PasswordResetChallengeRepository(UserDbContext context) : IPasswordResetChallengeRepository
{
    public Task AddAsync(PasswordResetChallenge challenge, CancellationToken ct = default) =>
        context.PasswordResetChallenges.AddAsync(challenge, ct).AsTask();

    public void Update(PasswordResetChallenge challenge) =>
        context.PasswordResetChallenges.Update(challenge);

    public Task<PasswordResetChallenge?> GetLatestByPhoneAsync(string phoneNormalized, CancellationToken ct = default) =>
        context.PasswordResetChallenges
            .Where(x => x.PhoneNormalized == phoneNormalized)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public Task<PasswordResetChallenge?> GetLatestActiveByPhoneAsync(string phoneNormalized, CancellationToken ct = default) =>
        context.PasswordResetChallenges
            .Where(x =>
                x.PhoneNormalized == phoneNormalized
                && !x.IsConsumed
                && x.OtpExpiresAt > DateTime.UtcNow
                && x.ResetToken == null)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public Task<PasswordResetChallenge?> GetByResetTokenAsync(string resetToken, CancellationToken ct = default) =>
        context.PasswordResetChallenges
            .Include(x => x.User)
            .FirstOrDefaultAsync(
                x => x.ResetToken == resetToken
                    && !x.IsConsumed
                    && x.ResetTokenExpiresAt != null
                    && x.ResetTokenExpiresAt > DateTime.UtcNow,
                ct);

    public async Task InvalidateOpenChallengesAsync(string phoneNormalized, CancellationToken ct = default)
    {
        var open = await context.PasswordResetChallenges
            .Where(x => x.PhoneNormalized == phoneNormalized && !x.IsConsumed)
            .ToListAsync(ct);

        foreach (var item in open)
        {
            item.IsConsumed = true;
        }
    }

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        context.SaveChangesAsync(ct);
}
