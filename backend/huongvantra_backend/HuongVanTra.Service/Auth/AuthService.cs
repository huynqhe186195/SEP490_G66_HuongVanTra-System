using HuongVanTra.Core.Authorization;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace HuongVanTra.Service.Auth {
    public class AuthService : IAuthService {
        private static readonly ConcurrentDictionary<string, DateTime> RevokedRefreshTokenJti = new(StringComparer.Ordinal);

        private readonly AppDbContext _dbContext;
        private readonly IConfiguration _configuration;

        public AuthService(AppDbContext dbContext, IConfiguration configuration) {
            _dbContext = dbContext;
            _configuration = configuration;
        }

        public async Task<AuthResult?> LoginAsync(string username, string password) {
            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive == 1);

            if (user is null || !string.Equals(user.PasswordHash, password, StringComparison.Ordinal)) {
                return null;
            }

            var roleNames = GetRoleNames(user);
            var (accessToken, accessTokenExpiresAtUtc) = GenerateAccessToken(user, roleNames);
            var (refreshToken, refreshTokenExpiresAtUtc) = GenerateRefreshToken(user);

            user.LastLoginAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return new AuthResult {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                Username = user.Username,
                Roles = roleNames,
                ExpiresAtUtc = accessTokenExpiresAtUtc,
                RefreshTokenExpiresAtUtc = refreshTokenExpiresAtUtc
            };
        }

        public async Task<AuthResult?> RefreshAsync(string accessToken, string refreshToken) {
            ClaimsPrincipal? accessPrincipal;
            ClaimsPrincipal? refreshPrincipal;

            try {
                accessPrincipal = GetPrincipalFromToken(accessToken, validateLifetime: false);
                refreshPrincipal = GetPrincipalFromToken(refreshToken, validateLifetime: true);
            }
            catch {
                return null;
            }

            CleanupRevokedTokenCache();

            var accessSub = accessPrincipal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? accessPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var refreshSub = refreshPrincipal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? refreshPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var tokenType = refreshPrincipal.FindFirst("token_type")?.Value;
            var refreshJti = refreshPrincipal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

            if (!string.Equals(tokenType, "refresh", StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(accessSub) ||
                !string.Equals(accessSub, refreshSub, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(refreshJti) ||
                RevokedRefreshTokenJti.ContainsKey(refreshJti) ||
                !int.TryParse(accessSub, out var userId)) {
                return null;
            }

            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == 1);

            if (user is null) {
                return null;
            }

            var roleNames = GetRoleNames(user);
            var (newAccessToken, accessTokenExpiresAtUtc) = GenerateAccessToken(user, roleNames);
            var (newRefreshToken, refreshTokenExpiresAtUtc) = GenerateRefreshToken(user);

            RevokedRefreshTokenJti[refreshJti] = DateTime.UtcNow.AddDays(7);

            return new AuthResult {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken,
                Username = user.Username,
                Roles = roleNames,
                ExpiresAtUtc = accessTokenExpiresAtUtc,
                RefreshTokenExpiresAtUtc = refreshTokenExpiresAtUtc
            };
        }

        public Task<bool> LogoutAsync(string refreshToken, int currentUserId) {
            ClaimsPrincipal? refreshPrincipal;
            try {
                refreshPrincipal = GetPrincipalFromToken(refreshToken, validateLifetime: false);
            }
            catch {
                return Task.FromResult(false);
            }

            var tokenType = refreshPrincipal.FindFirst("token_type")?.Value;
            var refreshJti = refreshPrincipal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
            var refreshSub = refreshPrincipal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? refreshPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.Equals(tokenType, "refresh", StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(refreshJti) ||
                !int.TryParse(refreshSub, out var refreshUserId) ||
                refreshUserId != currentUserId) {
                return Task.FromResult(false);
            }

            RevokedRefreshTokenJti[refreshJti] = DateTime.UtcNow.AddDays(7);
            CleanupRevokedTokenCache();
            return Task.FromResult(true);
        }

        public async Task<CurrentUserResult?> GetCurrentUserAsync(int userId) {
            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == 1);

            if (user is null) {
                return null;
            }

            return new CurrentUserResult {
                UserId = user.Id,
                Username = user.Username,
                EmployeeId = user.EmployeeId,
                IsActive = user.IsActive == 1,
                LastLoginAtUtc = user.LastLoginAt,
                Roles = GetRoleNames(user)
            };
        }

        private static List<string> GetRoleNames(User user) {
            return user.Employee?.EmployeeRoles
                .Select(er => er.Role.Name)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>();
        }

        private static void CleanupRevokedTokenCache() {
            var now = DateTime.UtcNow;
            foreach (var item in RevokedRefreshTokenJti.Where(kvp => kvp.Value <= now).ToList()) {
                RevokedRefreshTokenJti.TryRemove(item.Key, out _);
            }
        }

        private (string token, DateTime expiresAtUtc) GenerateAccessToken(User user, List<string> roleNames) {
            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"];

            if (string.IsNullOrWhiteSpace(jwtKey) || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience)) {
                throw new InvalidOperationException("JWT configuration is missing.");
            }

            var expiresAtUtc = DateTime.UtcNow.AddHours(8);
            var claims = new List<Claim> {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.UniqueName, user.Username),
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Username),
            };

            if (user.EmployeeId > 0) {
                claims.Add(new Claim(AppClaims.EmployeeId, user.EmployeeId.ToString()));
            }

            foreach (var role in roleNames) {
                claims.Add(new Claim(ClaimTypes.Role, role));
                claims.Add(new Claim(AppClaims.Role, role));
            }

            var signingCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                SecurityAlgorithms.HmacSha256);

            var jwtToken = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: signingCredentials);

            return (new JwtSecurityTokenHandler().WriteToken(jwtToken), expiresAtUtc);
        }

        private (string token, DateTime expiresAtUtc) GenerateRefreshToken(User user) {
            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"];

            if (string.IsNullOrWhiteSpace(jwtKey) || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience)) {
                throw new InvalidOperationException("JWT configuration is missing.");
            }

            var expiresAtUtc = DateTime.UtcNow.AddDays(7);
            var claims = new List<Claim> {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.UniqueName, user.Username),
                new("token_type", "refresh"),
                new(JwtRegisteredClaimNames.Jti, Convert.ToHexString(RandomNumberGenerator.GetBytes(16)))
            };

            var signingCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                SecurityAlgorithms.HmacSha256);

            var jwtToken = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: signingCredentials);

            return (new JwtSecurityTokenHandler().WriteToken(jwtToken), expiresAtUtc);
        }

        private ClaimsPrincipal GetPrincipalFromToken(string token, bool validateLifetime) {
            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"];

            if (string.IsNullOrWhiteSpace(jwtKey) || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience)) {
                throw new InvalidOperationException("JWT configuration is missing.");
            }

            var tokenValidationParameters = new TokenValidationParameters {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = validateLifetime,
                ValidIssuer = jwtIssuer,
                ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ClockSkew = TimeSpan.Zero
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwtSecurityToken ||
                !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase)) {
                throw new SecurityTokenException("Invalid token");
            }

            return principal;
        }
    }
}
