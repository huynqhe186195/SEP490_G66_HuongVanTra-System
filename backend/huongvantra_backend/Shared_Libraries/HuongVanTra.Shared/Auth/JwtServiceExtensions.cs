using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace HuongVanTra.Shared.Auth;

public static class JwtServiceExtensions
{
    public static IServiceCollection AddHvtJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection("Jwt");
        var secret = jwtSection["Secret"] ?? throw new InvalidOperationException("Jwt:Secret is missing.");
        var issuer = jwtSection["Issuer"];
        var audience = jwtSection["Audience"];

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                    ValidateIssuer = issuer is not null,
                    ValidIssuer = issuer,
                    ValidateAudience = audience is not null,
                    ValidAudience = audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    // JWT outbound thường ghi claim ngắn "role"; IsInRole/[Authorize(Roles)] cần khớp.
                    RoleClaimType = "role",
                    NameClaimType = "username",
                };

                // Giữ cả ClaimTypes.Role lẫn "role" sau khi đọc token.
                options.MapInboundClaims = false;

                // Invalid/expired token must not break [AllowAnonymous] read endpoints.
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        context.NoResult();
                        return Task.CompletedTask;
                    },
                };
            });

        return services;
    }
}
