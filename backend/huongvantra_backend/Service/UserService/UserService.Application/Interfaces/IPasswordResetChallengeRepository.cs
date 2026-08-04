using UserService.Domain.Entities;

namespace UserService.Application.Interfaces;

public interface IPasswordResetChallengeRepository
{
    Task AddAsync(PasswordResetChallenge challenge, CancellationToken ct = default);
    void Update(PasswordResetChallenge challenge);
    Task<PasswordResetChallenge?> GetLatestByPhoneAsync(string phoneNormalized, CancellationToken ct = default);
    Task<PasswordResetChallenge?> GetLatestActiveByPhoneAsync(string phoneNormalized, CancellationToken ct = default);
    Task<PasswordResetChallenge?> GetByResetTokenAsync(string resetToken, CancellationToken ct = default);
    Task InvalidateOpenChallengesAsync(string phoneNormalized, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
