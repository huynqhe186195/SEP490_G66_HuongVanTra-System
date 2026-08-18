using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class AuthLoginAccountStatusTests
{
    [Fact]
    public async Task Login_deactivated_employee_returns_vietnamese_deactivated_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var created = await UserServiceTestContext.CreateUserLogic(db).CreateAsync(new CreateUserRequest(
            "deactivated_user",
            "123456",
            [await RoleId(db, "SalePos")],
            "Deactivated User",
            "Sales",
            0,
            null));
        await UserServiceTestContext.CreateEmployeeLogic(db).DeactivateAsync(created.Employee!.Id);

        var ex = await Assert.ThrowsAsync<UserDeactivatedException>(
            () => CreateAuth(db).LoginAsync(new LoginRequest("deactivated_user", "123456")));

        Assert.Equal("Tài khoản đã được cho ngừng hoạt động.", ex.Message);
    }

    [Fact]
    public async Task Login_soft_deleted_user_returns_vietnamese_deactivated_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var created = await UserServiceTestContext.CreateUserLogic(db).CreateAsync(new CreateUserRequest(
            "deleted_user",
            "123456",
            [await RoleId(db, "SalePos")],
            "Deleted User",
            "Sales",
            0,
            null));
        await UserServiceTestContext.CreateUserLogic(db).SoftDeleteAsync(created.Id);

        var ex = await Assert.ThrowsAsync<UserDeactivatedException>(
            () => CreateAuth(db).LoginAsync(new LoginRequest("deleted_user", "123456")));

        Assert.Equal("Tài khoản đã được cho ngừng hoạt động.", ex.Message);
    }

    [Fact]
    public async Task Login_locked_user_returns_vietnamese_locked_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var created = await UserServiceTestContext.CreateUserLogic(db).CreateAsync(new CreateUserRequest(
            "locked_user",
            "123456",
            [await RoleId(db, "SalePos")],
            "Locked User",
            "Sales",
            0,
            null));
        await UserServiceTestContext.CreateUserLogic(db).LockAsync(created.Id);

        var ex = await Assert.ThrowsAsync<UserInactiveException>(
            () => CreateAuth(db).LoginAsync(new LoginRequest("locked_user", "123456")));

        Assert.Equal("Tài khoản đã bị khoá.", ex.Message);
    }

    private static async Task<int> RoleId(UserDbContext db, string roleName) =>
        await Task.FromResult(db.Roles.Single(role => role.RoleName == roleName).Id);

    private static AuthLogic CreateAuth(UserDbContext db) =>
        new(
            new UserRepository(db),
            new RoleRepository(db),
            new RefreshTokenRepository(db),
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Secret"] = "BatchC-Test-Secret-Key-With-At-Least-32-Characters",
                    ["Jwt:Issuer"] = "UserServiceTests",
                    ["Jwt:Audience"] = "UserServiceTests"
                })
                .Build());
}
