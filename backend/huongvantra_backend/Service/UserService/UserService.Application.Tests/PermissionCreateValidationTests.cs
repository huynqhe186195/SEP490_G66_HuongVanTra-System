using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class PermissionCreateValidationTests
{
    [Fact]
    public async Task Create_stores_name_and_code_in_the_correct_fields()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var created = await CreateLogic(db).CreateAsync(new CreatePermissionRequest
        {
            PermissionName = "Export Log",
            PermissionCode = "EXPORT_LOG",
        });

        Assert.Equal("Export Log", created.PermissionName);
        Assert.Equal("EXPORT_LOG", created.PermissionCode);

        var stored = await db.Permissions.FindAsync(created.Id);
        Assert.NotNull(stored);
        Assert.Equal("Export Log", stored!.PermissionName);
        Assert.Equal("EXPORT_LOG", stored.PermissionCode);
    }

    [Theory]
    [InlineData(null, "EXPORT_LOG")]
    [InlineData("", "EXPORT_LOG")]
    [InlineData("   ", "EXPORT_LOG")]
    public async Task Create_rejects_empty_permission_name(string? name, string code)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => CreateLogic(db).CreateAsync(new CreatePermissionRequest
            {
                PermissionName = name!,
                PermissionCode = code,
            }));

        Assert.Equal("Tên quyền không được để trống.", ex.Message);
    }

    [Theory]
    [InlineData("Export Log", null)]
    [InlineData("Export Log", "")]
    [InlineData("Export Log", "   ")]
    public async Task Create_rejects_empty_permission_code(string name, string? code)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => CreateLogic(db).CreateAsync(new CreatePermissionRequest
            {
                PermissionName = name,
                PermissionCode = code!,
            }));

        Assert.Equal("Mã quyền không được để trống.", ex.Message);
    }

    [Theory]
    [InlineData("Export~Log")]
    [InlineData("Manage Shelf/Inventory")]
    public async Task Create_rejects_invalid_permission_name(string name)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => CreateLogic(db).CreateAsync(new CreatePermissionRequest
            {
                PermissionName = name,
                PermissionCode = "EXPORT_LOG",
            }));

        Assert.Contains("Tên quyền không hợp lệ", ex.Message);
    }

    [Theory]
    [InlineData("EXPORT LOG")]
    [InlineData("MANAGE~SHELF/INVENTORY")]
    public async Task Create_rejects_invalid_permission_code(string code)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => CreateLogic(db).CreateAsync(new CreatePermissionRequest
            {
                PermissionName = "Export Log",
                PermissionCode = code,
            }));

        Assert.Contains("Mã quyền không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task Create_rejects_duplicate_permission_code()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = CreateLogic(db);
        await logic.CreateAsync(new CreatePermissionRequest
        {
            PermissionName = "Export Log",
            PermissionCode = "EXPORT_LOG",
        });

        var ex = await Assert.ThrowsAsync<DuplicatePermissionException>(
            () => logic.CreateAsync(new CreatePermissionRequest
            {
                PermissionName = "Export Logs",
                PermissionCode = "EXPORT_LOG",
            }));

        Assert.Equal("Mã quyền 'EXPORT_LOG' đã tồn tại.", ex.Message);
    }

    private static PermissionLogic CreateLogic(UserDbContext db) =>
        new(new PermissionRepository(db));
}
