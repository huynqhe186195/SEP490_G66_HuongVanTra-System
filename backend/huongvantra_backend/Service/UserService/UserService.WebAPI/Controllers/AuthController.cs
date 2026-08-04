using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;
using UserService.WebAPI.Extensions;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthLogic authLogic, UserLogic userLogic, PasswordResetLogic passwordResetLogic) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authLogic.LoginAsync(request);
        return Ok(result);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var result = await passwordResetLogic.RequestOtpAsync(request);
        return Ok(result);
    }

    [HttpPost("forgot-password/verify-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyForgotPasswordOtp([FromBody] VerifyForgotPasswordOtpRequest request)
    {
        var result = await passwordResetLogic.VerifyOtpAsync(request);
        return Ok(result);
    }

    [HttpPost("forgot-password/reset")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPasswordWithToken([FromBody] ResetPasswordWithTokenRequest request)
    {
        await passwordResetLogic.ResetWithTokenAsync(request);
        return NoContent();
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await authLogic.RefreshTokenAsync(request);
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        await authLogic.LogoutAsync(request);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);
        var result = await userLogic.GetByIdAsync(userId);
        return Ok(result);
    }

    /// <summary>Kiểm tra phiên còn hiệu lực (chưa bị đăng nhập ở thiết bị khác).</summary>
    [HttpGet("session")]
    [Authorize]
    public async Task<IActionResult> Session()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);
        var versionRaw = User.FindFirstValue(AuthLogic.SessionVersionClaim) ?? "0";
        if (!int.TryParse(versionRaw, out var tokenVersion))
            tokenVersion = 0;

        await authLogic.EnsureSessionActiveAsync(userId, tokenVersion);
        return Ok(new { active = true, sessionVersion = tokenVersion });
    }

    [HttpPost("update-profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateMyProfileRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);
        var result = await userLogic.UpdateMyProfileAsync(userId, request);
        return Ok(result);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] AuthChangePasswordRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);
        await authLogic.ChangePasswordAsync(userId, request);
        return NoContent();
    }

    [HttpPost("reset-password")]
    [Authorize]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (!User.HasClaim("permission", PermissionNames.ManageUser)
            && !User.HasClaim("permission", PermissionNames.ManageEmployee))
        {
            return Forbid();
        }

        await authLogic.ResetPasswordAsync(request, User.GetPermissions());
        return NoContent();
    }
}
