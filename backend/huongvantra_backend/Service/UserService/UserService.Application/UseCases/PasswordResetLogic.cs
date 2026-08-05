using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Application.Validation;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class PasswordResetLogic(
    IUserRepository userRepo,
    IPasswordResetChallengeRepository challengeRepo,
    IRefreshTokenRepository refreshTokenRepo,
    ISmsSender smsSender,
    IConfiguration config,
    ILogger<PasswordResetLogic> logger)
{
    private static readonly Regex DigitsRegex = new(@"\D", RegexOptions.Compiled);

    public async Task<ForgotPasswordResponse> RequestOtpAsync(ForgotPasswordRequest request)
    {
        var phone = NormalizePhone(request.Phone);
        if (!VietnamPhoneValidator.TryValidate(phone, out var phoneError))
            throw new UserValidationException(phoneError ?? "Số điện thoại không hợp lệ.");

        var resendSeconds = GetInt("PasswordReset:ResendCooldownSeconds", 60);
        var otpTtlMinutes = GetInt("PasswordReset:OtpTtlMinutes", 10);
        // Khi SMS thật đang bật: không trả OTP ra API (trừ khi cấu hình ép Expose).
        var exposeOtp = GetBool("PasswordReset:ExposeOtpInResponse", false)
            && !smsSender.IsEnabled;

        var existing = await challengeRepo.GetLatestByPhoneAsync(phone);
        if (existing is not null)
        {
            var elapsed = DateTime.UtcNow - existing.CreatedAt;
            if (elapsed.TotalSeconds < resendSeconds)
            {
                var wait = Math.Max(1, resendSeconds - (int)elapsed.TotalSeconds);
                throw new PasswordResetException($"Vui lòng đợi {wait} giây trước khi gửi lại mã OTP.");
            }
        }

        var user = await userRepo.GetByEmployeePhoneAsync(phone);
        var masked = MaskPhone(phone);

        // Không tiết lộ tài khoản có tồn tại hay không.
        if (user is null)
        {
            logger.LogInformation("Forgot-password: no active user for phone ending {Tail}", phone[^Math.Min(4, phone.Length)..]);
            return new ForgotPasswordResponse(
                true,
                "Nếu số điện thoại tồn tại trong hệ thống, mã OTP đã được gửi.",
                masked,
                resendSeconds,
                null);
        }

        var otp = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        await challengeRepo.InvalidateOpenChallengesAsync(phone);

        var challenge = new PasswordResetChallenge
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PhoneNormalized = phone,
            OtpHash = BCrypt.Net.BCrypt.HashPassword(otp),
            OtpExpiresAt = DateTime.UtcNow.AddMinutes(otpTtlMinutes),
            CreatedAt = DateTime.UtcNow,
        };

        await challengeRepo.AddAsync(challenge);
        await challengeRepo.SaveChangesAsync();

        var template = config["Sms:OtpTemplate"];
        if (string.IsNullOrWhiteSpace(template))
        {
            template = "HVT: Ma OTP dat lai mat khau la {otp}. Hieu luc {minutes} phut. Khong chia se ma nay.";
        }

        var message = template
            .Replace("{otp}", otp, StringComparison.OrdinalIgnoreCase)
            .Replace("{minutes}", otpTtlMinutes.ToString(), StringComparison.OrdinalIgnoreCase);

        try
        {
            await smsSender.SendAsync(phone, message);
        }
        catch (PasswordResetException)
        {
            challenge.IsConsumed = true;
            challengeRepo.Update(challenge);
            await challengeRepo.SaveChangesAsync();
            throw;
        }

        if (!smsSender.IsEnabled)
        {
            logger.LogWarning(
                "Password reset OTP (log-only) for user {Username} phone ***{Tail}: {Otp}",
                user.Username,
                phone[^Math.Min(4, phone.Length)..],
                otp);
        }

        return new ForgotPasswordResponse(
            true,
            smsSender.IsEnabled
                ? "Mã OTP đã được gửi tới số điện thoại của bạn."
                : "Nếu số điện thoại tồn tại trong hệ thống, mã OTP đã được gửi.",
            masked,
            resendSeconds,
            exposeOtp ? otp : null);
    }

    public async Task<VerifyForgotPasswordOtpResponse> VerifyOtpAsync(VerifyForgotPasswordOtpRequest request)
    {
        var phone = NormalizePhone(request.Phone);
        var otp = (request.Otp ?? string.Empty).Trim();
        if (!VietnamPhoneValidator.TryValidate(phone, out var phoneError))
            throw new UserValidationException(phoneError ?? "Số điện thoại không hợp lệ.");
        if (otp.Length != 6 || otp.Any(c => !char.IsDigit(c)))
            throw new UserValidationException("Mã OTP phải gồm 6 chữ số.");

        var maxAttempts = GetInt("PasswordReset:MaxFailedAttempts", 5);
        var resetTtlMinutes = GetInt("PasswordReset:ResetTokenTtlMinutes", 15);

        var challenge = await challengeRepo.GetLatestActiveByPhoneAsync(phone)
            ?? throw new PasswordResetException("Mã OTP không hợp lệ hoặc đã hết hạn.");

        if (challenge.FailedAttempts >= maxAttempts)
            throw new PasswordResetException("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi lại mã mới.");

        if (!BCrypt.Net.BCrypt.Verify(otp, challenge.OtpHash))
        {
            challenge.FailedAttempts += 1;
            challengeRepo.Update(challenge);
            await challengeRepo.SaveChangesAsync();
            throw new PasswordResetException("Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại.");
        }

        var resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        challenge.ResetToken = resetToken;
        challenge.ResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(resetTtlMinutes);
        challenge.OtpExpiresAt = DateTime.UtcNow; // OTP one-time
        challenge.FailedAttempts = 0;
        challengeRepo.Update(challenge);
        await challengeRepo.SaveChangesAsync();

        return new VerifyForgotPasswordOtpResponse(resetToken, challenge.ResetTokenExpiresAt.Value);
    }

    public async Task ResetWithTokenAsync(ResetPasswordWithTokenRequest request)
    {
        var token = (request.ResetToken ?? string.Empty).Trim();
        var newPassword = request.NewPassword ?? string.Empty;
        if (string.IsNullOrWhiteSpace(token))
            throw new UserValidationException("Thiếu mã đặt lại mật khẩu.");
        if (newPassword.Length < 6)
            throw new UserValidationException("Mật khẩu mới phải có ít nhất 6 ký tự.");
        if (newPassword.Length > 100)
            throw new UserValidationException("Mật khẩu mới không được vượt quá 100 ký tự.");

        var challenge = await challengeRepo.GetByResetTokenAsync(token)
            ?? throw new PasswordResetException("Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");

        var user = challenge.User ?? await userRepo.GetByIdAsync(challenge.UserId)
            ?? throw new PasswordResetException("Tài khoản không tồn tại.");

        if (!user.IsActive || user.IsDeleted)
            throw new UserInactiveException();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.SessionVersion = checked(user.SessionVersion + 1);
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);

        challenge.IsConsumed = true;
        challenge.ResetToken = null;
        challengeRepo.Update(challenge);

        await refreshTokenRepo.RevokeAllForUserAsync(user.Id);
        await userRepo.SaveChangesAsync();
        await refreshTokenRepo.SaveChangesAsync();
        await challengeRepo.SaveChangesAsync();
    }

    private int GetInt(string key, int fallback)
    {
        var raw = config[key];
        return int.TryParse(raw, out var value) && value > 0 ? value : fallback;
    }

    private bool GetBool(string key, bool fallback)
    {
        var raw = config[key];
        return bool.TryParse(raw, out var value) ? value : fallback;
    }

    private static string NormalizePhone(string? phone) =>
        DigitsRegex.Replace(phone ?? string.Empty, string.Empty);

    private static string MaskPhone(string phone)
    {
        if (phone.Length < 7)
            return "****";
        return $"{phone[..2]}** *** {phone[^3..]}";
    }
}
