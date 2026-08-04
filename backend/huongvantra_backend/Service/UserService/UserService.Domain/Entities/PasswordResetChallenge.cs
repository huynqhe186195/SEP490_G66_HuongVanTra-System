namespace UserService.Domain.Entities;

/// <summary>OTP quên mật khẩu theo SĐT nhân viên (BankAccountInfo).</summary>
public class PasswordResetChallenge
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string PhoneNormalized { get; set; } = string.Empty;
    public string OtpHash { get; set; } = string.Empty;
    public DateTime OtpExpiresAt { get; set; }
    public string? ResetToken { get; set; }
    public DateTime? ResetTokenExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public bool IsConsumed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
