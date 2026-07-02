using UserService.Application.Authorization;
using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace UserService.Application.UseCases;

public class AuthLogic(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    IRefreshTokenRepository refreshTokenRepo,
    IConfiguration config)
{
    private const int AccessTokenHours = 8;
    private const int RefreshTokenDays = 7;

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await userRepo.GetByUsernameAsync(request.Username)
            ?? throw new InvalidCredentialsException();

        if (!user.IsActive) throw new UserInactiveException();

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new InvalidCredentialsException();

        user.LastLoginAt = DateTime.UtcNow;
        userRepo.Update(user);
        await userRepo.SaveChangesAsync();

        return await IssueTokensAsync(user);
    }

    public async Task<LoginResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var stored = await refreshTokenRepo.GetByTokenAsync(request.RefreshToken)
            ?? throw new InvalidRefreshTokenException();

        if (stored.IsRevoked || stored.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidRefreshTokenException();

        var user = await userRepo.GetByIdAsync(stored.UserId)
            ?? throw new InvalidRefreshTokenException();

        if (!user.IsActive) throw new UserInactiveException();

        stored.IsRevoked = true;
        refreshTokenRepo.Update(stored);
        await refreshTokenRepo.SaveChangesAsync();

        return await IssueTokensAsync(user);
    }

    public async Task LogoutAsync(LogoutRequest request)
    {
        var stored = await refreshTokenRepo.GetByTokenAsync(request.RefreshToken);
        if (stored is null) return;

        stored.IsRevoked = true;
        refreshTokenRepo.Update(stored);
        await refreshTokenRepo.SaveChangesAsync();
    }

    public async Task ChangePasswordAsync(Guid userId, AuthChangePasswordRequest request)
    {
        var user = await userRepo.GetByIdAsync(userId) ?? throw new UserNotFoundException(userId);

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new InvalidCredentialsException();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await refreshTokenRepo.RevokeAllForUserAsync(userId);
        await userRepo.SaveChangesAsync();
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, IReadOnlyList<string>? actorPermissions = null)
    {
        var user = await userRepo.GetByUsernameAsync(request.Username)
            ?? throw new UserNotFoundByUsernameException(request.Username);

        if (actorPermissions is not null)
        {
            StaffManagementScope.EnsureCanManageEmployee(
                actorPermissions,
                user.UserRoles.Select(ur => ur.Role.RoleName));
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        userRepo.Update(user);
        await refreshTokenRepo.RevokeAllForUserAsync(user.Id);
        await userRepo.SaveChangesAsync();
    }

    private async Task<LoginResponse> IssueTokensAsync(User user)
    {
        var roles = await roleRepo.GetByUserIdAsync(user.Id);
        var roleNames = roles.Select(r => r.RoleName).ToList();
        var permissions = roles
            .SelectMany(r => r.RolePermissions)
            .Select(rp => rp.Permission.PermissionName)
            .Distinct()
            .ToList();

        var expiresAt = DateTime.UtcNow.AddHours(AccessTokenHours);
        var accessToken = GenerateAccessToken(user, roleNames, permissions, expiresAt);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return new LoginResponse(
            accessToken,
            refreshToken,
            expiresAt,
            user.Username,
            roleNames,
            permissions);
    }

    private string GenerateAccessToken(User user, List<string> roles, List<string> permissions, DateTime expiresAt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Secret"]!));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new("username", user.Username),
        };
        if (!string.IsNullOrWhiteSpace(user.Employee?.FullName))
        {
            claims.Add(new Claim("full_name", user.Employee.FullName.Trim()));
            claims.Add(new Claim("name", user.Employee.FullName.Trim()));
        }
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
        };

        await refreshTokenRepo.AddAsync(refreshToken);
        await refreshTokenRepo.SaveChangesAsync();
        return tokenValue;
    }
}
