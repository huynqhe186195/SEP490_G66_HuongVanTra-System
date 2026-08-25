using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class AuthPermissionUnionTests
{
    [Fact]
    public async Task Login_returns_distinct_role_and_permission_union_for_dual_sale_user()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var roleIds = await db.Roles
            .Where(role => role.RoleName == "SalePos" || role.RoleName == "SaleCod")
            .Select(role => role.Id)
            .ToListAsync();
        var userLogic = UserServiceTestContext.CreateUserLogic(db);
        await userLogic.CreateAsync(new CreateUserRequest(
            "dual_login",
            "12345678",
            roleIds,
            "Dual Login",
            "Sales",
            0,
            null));
        var auth = new AuthLogic(
            new UserRepository(db),
            new RoleRepository(db),
            new RefreshTokenRepository(db),
            Configuration());

        var response = await auth.LoginAsync(new LoginRequest("dual_login", "12345678"));

        Assert.Equal(["SaleCod", "SalePos"], response.Roles.OrderBy(role => role));
        Assert.Contains(PermissionNames.CreatePosOrder, response.Permissions);
        Assert.Contains(PermissionNames.CreateCodOrder, response.Permissions);
        Assert.Contains(PermissionNames.VerifyCod, response.Permissions);
        Assert.DoesNotContain(PermissionNames.ManageCatalog, response.Permissions);
        Assert.Equal(response.Permissions.Count, response.Permissions.Distinct().Count());

        var token = new JwtSecurityTokenHandler().ReadJwtToken(response.AccessToken);
        // Token phát cả claim ngắn "role" (RoleClaimType cho [Authorize(Roles)]) lẫn ClaimTypes.Role
        // (SystemActivityAuditMiddleware đọc), nên so sánh theo giá trị role chứ không theo số claim.
        var tokenRoles = token.Claims
            .Where(claim => claim.Type is "role" || claim.Type == ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var tokenPermissions = token.Claims
            .Where(claim => claim.Type == "permission")
            .Select(claim => claim.Value)
            .ToList();
        Assert.Equal(["SaleCod", "SalePos"], tokenRoles.OrderBy(role => role));
        Assert.Equal(tokenPermissions.Count, tokenPermissions.Distinct().Count());
    }

    [Fact]
    public async Task Refresh_token_keeps_the_same_permission_union()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var user = await db.Users
            .Include(item => item.UserRoles)
            .SingleAsync(item => item.Username == "sale01");
        var saleCod = await db.Roles.SingleAsync(role => role.RoleName == "SaleCod");
        user.UserRoles.Add(new() { UserId = user.Id, RoleId = saleCod.Id });
        await db.SaveChangesAsync();
        var auth = new AuthLogic(
            new UserRepository(db),
            new RoleRepository(db),
            new RefreshTokenRepository(db),
            Configuration());
        var login = await auth.LoginAsync(new LoginRequest("sale01", "123456"));

        var refreshed = await auth.RefreshTokenAsync(new RefreshTokenRequest(login.RefreshToken));

        Assert.Contains(PermissionNames.CreatePosOrder, refreshed.Permissions);
        Assert.Contains(PermissionNames.CreateCodOrder, refreshed.Permissions);
        Assert.Contains(PermissionNames.VerifyCod, refreshed.Permissions);
        Assert.Equal(refreshed.Permissions.Count, refreshed.Permissions.Distinct().Count());
    }

    private static IConfiguration Configuration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "BatchC-Test-Secret-Key-With-At-Least-32-Characters",
                ["Jwt:Issuer"] = "UserServiceTests",
                ["Jwt:Audience"] = "UserServiceTests"
            })
            .Build();
}
