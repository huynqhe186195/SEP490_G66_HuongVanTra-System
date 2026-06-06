using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace UserService.Application.UseCases;

public class AuthLogic(IUserRepository userRepo, IRoleRepository roleRepo, IConfiguration config)
{
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

        var roles = await roleRepo.GetByUserIdAsync(user.Id);
        var roleNames = roles.Select(r => r.RoleName).ToList();
        var permissions = roles
            .SelectMany(r => r.RolePermissions)
            .Select(rp => rp.Permission.PermissionName)
            .Distinct()
            .ToList();

        var token = GenerateJwt(user, roleNames, permissions);
        return new LoginResponse(token, user.Username, roleNames, permissions);
    }

    private string GenerateJwt(User user, List<string> roles, List<string> permissions)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Secret"]!));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
