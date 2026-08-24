using Microsoft.EntityFrameworkCore;
using UserService.Application.DTOs.Requests;
using UserService.Application.Validation;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;

namespace UserService.Application.Tests;

public class UserCreateUpdateValidationTests
{
    [Fact]
    public async Task Create_duplicate_username_returns_vietnamese_conflict_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);
        await logic.CreateAsync(ValidCreate("sale89", roleId));

        var ex = await Assert.ThrowsAsync<DuplicateUsernameException>(
            () => logic.CreateAsync(ValidCreate("sale89", roleId)));

        Assert.Equal("Tên đăng nhập 'sale89' đã tồn tại", ex.Message);
    }

    [Fact]
    public async Task Create_empty_role_returns_vietnamese_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(ValidCreate("sale89", roleIds: [])));

        Assert.Equal(UserInputValidator.EmptyRolesMessage, ex.Message);
    }

    [Theory]
    [InlineData("sale89~")]
    [InlineData("sale/10")]
    public async Task Create_invalid_username_returns_vietnamese_message(string username)
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(ValidCreate(username, roleId)));

        Assert.Equal(UserInputValidator.InvalidUsernameMessage, ex.Message);
    }

    [Theory]
    [InlineData("12345678~")]
    [InlineData("12345678/")]
    public async Task Create_invalid_password_returns_vietnamese_message(string password)
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(ValidCreate("sale89", roleId, password: password)));

        Assert.Equal(UserInputValidator.InvalidPasswordMessage, ex.Message);
    }

    [Theory]
    [InlineData("Nguyễn Văn A~")]
    [InlineData("Lê/Thị/B")]
    public async Task Create_invalid_full_name_returns_vietnamese_message(string fullName)
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(ValidCreate("sale89", roleId, fullName: fullName)));

        Assert.Equal(UserInputValidator.InvalidFullNameMessage, ex.Message);
    }

    [Fact]
    public async Task Create_username_longer_than_50_returns_vietnamese_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);
        var username = "sale" + new string('7', 47);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(ValidCreate(username, roleId)));

        Assert.Equal(UserInputValidator.UsernameTooLongMessage, ex.Message);
        Assert.True(username.Length > 50);
    }

    [Fact]
    public async Task Update_empty_username_returns_vietnamese_message()
    {
        var ex = await UpdateAndCatch("", password: null, fullName: null);
        Assert.Equal(UserInputValidator.EmptyUsernameMessage, ex.Message);
    }

    [Fact]
    public async Task Update_empty_password_returns_vietnamese_message()
    {
        var ex = await UpdateAndCatch(null, password: "", fullName: null);
        Assert.Equal(UserInputValidator.EmptyPasswordMessage, ex.Message);
    }

    [Fact]
    public async Task Update_empty_full_name_returns_vietnamese_message()
    {
        var ex = await UpdateAndCatch(null, password: null, fullName: "");
        Assert.Equal(UserInputValidator.EmptyFullNameMessage, ex.Message);
    }

    [Theory]
    [InlineData("sale89~")]
    [InlineData("sale/10")]
    public async Task Update_invalid_username_returns_vietnamese_message(string username)
    {
        var ex = await UpdateAndCatch(username, password: null, fullName: null);
        Assert.Equal(UserInputValidator.InvalidUsernameMessage, ex.Message);
    }

    [Theory]
    [InlineData("12345678~")]
    [InlineData("12345678/")]
    public async Task Update_invalid_password_returns_vietnamese_message(string password)
    {
        var ex = await UpdateAndCatch(null, password, fullName: null);
        Assert.Equal(UserInputValidator.InvalidPasswordMessage, ex.Message);
    }

    [Theory]
    [InlineData("Nguyễn Văn A~")]
    [InlineData("Lê/Thị/B")]
    public async Task Update_invalid_full_name_returns_vietnamese_message(string fullName)
    {
        var ex = await UpdateAndCatch(null, password: null, fullName);
        Assert.Equal(UserInputValidator.InvalidFullNameMessage, ex.Message);
    }

    [Fact]
    public async Task Update_duplicate_username_returns_vietnamese_conflict_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);
        var first = await logic.CreateAsync(ValidCreate("sale89", roleId));
        await logic.CreateAsync(ValidCreate("sale10", roleId));

        var ex = await Assert.ThrowsAsync<DuplicateUsernameException>(
            () => logic.UpdateAsync(first.Id, new UpdateUserRequest(
                true,
                [roleId],
                Username: "sale10")));

        Assert.Equal("Tên đăng nhập 'sale10' đã tồn tại", ex.Message);
    }

    [Fact]
    public async Task Update_username_longer_than_50_returns_vietnamese_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);
        var created = await logic.CreateAsync(ValidCreate("sale89", roleId));
        var username = "sale" + new string('9', 47);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateUserRequest(
                true,
                [roleId],
                Username: username)));

        Assert.Equal(UserInputValidator.UsernameTooLongMessage, ex.Message);
        Assert.True(username.Length > 50);
    }

    private static async Task<UserValidationException> UpdateAndCatch(
        string? username,
        string? password,
        string? fullName)
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var roleId = await SalePosId(db);
        var created = await logic.CreateAsync(ValidCreate("sale89", roleId));

        return await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateUserRequest(
                true,
                [roleId],
                Username: username,
                Password: password,
                FullName: fullName)));
    }

    private static CreateUserRequest ValidCreate(
        string username,
        int roleId,
        string password = "12345678",
        string fullName = "Nguyen Van A") =>
        ValidCreate(username, (List<int>?)[roleId], password, fullName);

    private static CreateUserRequest ValidCreate(
        string username,
        List<int>? roleIds,
        string password = "12345678",
        string fullName = "Nguyen Van A") =>
        new(username, password, roleIds, fullName, "Sales", 0, null);

    private static async Task<int> SalePosId(UserDbContext db) =>
        await db.Roles
            .Where(role => role.RoleName == "SalePos")
            .Select(role => role.Id)
            .SingleAsync();
}
