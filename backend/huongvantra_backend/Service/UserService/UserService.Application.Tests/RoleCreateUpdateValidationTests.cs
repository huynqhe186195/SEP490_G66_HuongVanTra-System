using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Application.Validation;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

public class RoleCreateUpdateValidationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_rejects_empty_role_name(string? name)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(new CreateRoleRequest(name!, null, [permissionId])));

        Assert.Equal(RoleInputValidator.EmptyNameMessage, ex.Message);
    }

    [Fact]
    public async Task Create_rejects_empty_permissions()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = new RoleLogic(new RoleRepository(db), new PermissionRepository(db));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [])));

        Assert.Equal(RoleInputValidator.EmptyPermissionsMessage, ex.Message);
    }

    [Theory]
    [InlineData("Product~Manager")]
    [InlineData("Contract/Manager")]
    public async Task Create_rejects_invalid_role_name(string name)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(new CreateRoleRequest(name, null, [permissionId])));

        Assert.Equal(RoleInputValidator.InvalidNameMessage, ex.Message);
    }

    [Fact]
    public async Task Create_rejects_missing_permission_ids()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var logic = new RoleLogic(new RoleRepository(db), new PermissionRepository(db));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [11, 22])));

        Assert.Equal("Quyền với ID '11, 22' không tồn tại", ex.Message);
    }

    [Fact]
    public async Task Create_rejects_duplicate_role_name()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<DuplicateRoleException>(
            () => logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId])));

        Assert.Equal("Tên vai trò 'ProductManager' đã tồn tại", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Update_rejects_empty_role_name(string? name)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateRoleRequest(name!, null, [permissionId])));

        Assert.Equal(RoleInputValidator.EmptyNameMessage, ex.Message);
    }

    [Fact]
    public async Task Update_rejects_empty_permissions()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateRoleRequest("ProductManager", null, [])));

        Assert.Equal(RoleInputValidator.EmptyPermissionsMessage, ex.Message);
    }

    [Theory]
    [InlineData("Product~Manager")]
    [InlineData("Contract/Manager")]
    public async Task Update_rejects_invalid_role_name(string name)
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateRoleRequest(name, null, [permissionId])));

        Assert.Equal(RoleInputValidator.InvalidNameMessage, ex.Message);
    }

    [Fact]
    public async Task Update_rejects_missing_permission_ids()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        var created = await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<UserValidationException>(
            () => logic.UpdateAsync(created.Id, new UpdateRoleRequest("ProductManager", null, [11, 22])));

        Assert.Equal("Quyền với ID '11, 22' không tồn tại", ex.Message);
    }

    [Fact]
    public async Task Update_rejects_duplicate_role_name()
    {
        await using var db = UserServiceTestContext.CreateDb();
        var (logic, permissionId) = await CreateLogicWithPermission(db);
        await logic.CreateAsync(new CreateRoleRequest("ProductManager", null, [permissionId]));
        var other = await logic.CreateAsync(new CreateRoleRequest("ContractManager", null, [permissionId]));

        var ex = await Assert.ThrowsAsync<DuplicateRoleException>(
            () => logic.UpdateAsync(other.Id, new UpdateRoleRequest("ProductManager", null, [permissionId])));

        Assert.Equal("Tên vai trò 'ProductManager' đã tồn tại", ex.Message);
    }

    private static async Task<(RoleLogic Logic, int PermissionId)> CreateLogicWithPermission(UserDbContext db)
    {
        var permissionLogic = new PermissionLogic(new PermissionRepository(db));
        var permission = await permissionLogic.CreateAsync(new CreatePermissionRequest
        {
            PermissionName = "View Order",
            PermissionCode = "VIEW_ORDER_TEST",
        });
        return (new RoleLogic(new RoleRepository(db), new PermissionRepository(db)), permission.Id);
    }
}
