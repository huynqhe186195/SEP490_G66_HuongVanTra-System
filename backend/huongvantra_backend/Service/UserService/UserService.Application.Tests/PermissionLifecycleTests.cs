using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class PermissionLifecycleTests
{
    [Fact]
    public async Task SoftDelete_already_deactivated_permission_returns_vietnamese_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = CreateLogic(db);
        var created = await logic.CreateAsync(new CreatePermissionRequest
        {
            PermissionName = "Export Log",
            PermissionCode = "EXPORT_LOG",
        });
        await logic.SoftDeleteAsync(created.Id);

        var ex = await Assert.ThrowsAsync<PermissionAlreadyDeactivatedException>(
            () => logic.SoftDeleteAsync(created.Id));

        Assert.Equal($"Quyền với ID '{created.Id}' đã bị ngừng hoạt động", ex.Message);
    }

    [Fact]
    public async Task SoftDelete_missing_permission_returns_vietnamese_not_found_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<PermissionNotFoundException>(
            () => CreateLogic(db).SoftDeleteAsync(99999));

        Assert.Equal("Quyền với ID '99999' không tồn tại", ex.Message);
    }

    [Fact]
    public async Task Restore_missing_permission_returns_vietnamese_not_found_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var ex = await Assert.ThrowsAsync<PermissionNotFoundException>(
            () => CreateLogic(db).RestoreAsync(99999));

        Assert.Equal("Quyền với ID '99999' không tồn tại", ex.Message);
    }

    private static PermissionLogic CreateLogic(UserService.Infrastructure.Data.UserDbContext db) =>
        new(new PermissionRepository(db));
}
