using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class RoleLifecycleTests
{
    [Fact]
    public async Task Delete_already_deactivated_role_returns_vietnamese_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));
        await logic.DeleteAsync(created.Id);

        var ex = await Assert.ThrowsAsync<RoleAlreadyDeactivatedException>(
            () => logic.DeleteAsync(created.Id));

        Assert.Equal($"Vai trò với ID '{created.Id}' đã bị ngừng hoạt động", ex.Message);
    }

    [Fact]
    public async Task Delete_missing_role_returns_vietnamese_not_found_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = new RoleLogic(new RoleRepository(db), new PermissionRepository(db));

        var ex = await Assert.ThrowsAsync<RoleNotFoundException>(() => logic.DeleteAsync(99999));

        Assert.Equal("Vai trò với ID '99999' không tồn tại", ex.Message);
    }

    [Fact]
    public async Task Restore_active_role_is_idempotent()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        await logic.RestoreAsync(created.Id);

        var restored = await logic.GetByIdAsync(created.Id);
        Assert.False(restored.IsDeleted);
        Assert.Equal("ProductManager", restored.RoleName);
    }

    [Fact]
    public async Task Restore_missing_role_returns_vietnamese_not_found_message()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = new RoleLogic(new RoleRepository(db), new PermissionRepository(db));

        var ex = await Assert.ThrowsAsync<RoleNotFoundException>(() => logic.RestoreAsync(99999));

        Assert.Equal("Vai trò với ID '99999' không tồn tại", ex.Message);
    }

    private static async Task<(RoleLogic Logic, int PermissionId)> CreateLogicWithPermission(UserDbContext db)
    {
        var permission = await new PermissionLogic(new PermissionRepository(db)).CreateAsync(
            new CreatePermissionRequest
            {
                PermissionName = "View Order",
                PermissionCode = "VIEW_ORDER_ROLE_LIFECYCLE",
            });
        return (new RoleLogic(new RoleRepository(db), new PermissionRepository(db)), permission.Id);
    }
}
