using Microsoft.EntityFrameworkCore;
using UserService.Application.DTOs.Requests;
using UserService.Application.Validation;
using UserService.Domain.Constants;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Data;

namespace UserService.Application.Tests;

public class MultiRoleUserManagementTests
{
    [Fact]
    public void ResolveRoleIds_accepts_multiple_distinct_roles()
    {
        Assert.Equal([2, 3], UserInputValidator.ResolveRoleIds([2, 3]));
    }

    [Fact]
    public void ResolveRoleIds_supports_legacy_single_RoleId()
    {
        Assert.Equal([7], UserInputValidator.ResolveRoleIds(null, 7));
    }

    [Fact]
    public void ResolveRoleIds_rejects_empty_assignment()
    {
        Assert.Throws<UserValidationException>(() => UserInputValidator.ResolveRoleIds(null));
    }

    [Fact]
    public void ResolveRoleIds_rejects_duplicates()
    {
        Assert.Throws<UserValidationException>(() => UserInputValidator.ResolveRoleIds([2, 2]));
    }

    [Fact]
    public async Task Create_user_accepts_SalePos_and_SaleCod()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var roleIds = await SaleRoleIds(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);

        var created = await logic.CreateAsync(new CreateUserRequest(
            "dual_create",
            "123456",
            roleIds,
            "Dual Create",
            "Sales",
            0,
            null));

        Assert.Equal(["SaleCod", "SalePos"], created.Roles.OrderBy(role => role));
    }

    [Fact]
    public async Task Create_user_with_one_role_still_succeeds()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var salePosId = await db.Roles
            .Where(role => role.RoleName == "SalePos")
            .Select(role => role.Id)
            .SingleAsync();
        var logic = UserServiceTestContext.CreateUserLogic(db);

        var created = await logic.CreateAsync(new CreateUserRequest(
            "single_role_create",
            "123456",
            [salePosId],
            "Single Role",
            "Sales",
            0,
            null));

        Assert.Equal(["SalePos"], created.Roles);
    }

    [Fact]
    public async Task Create_user_rejects_unknown_role_id()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var logic = UserServiceTestContext.CreateUserLogic(db);

        await Assert.ThrowsAsync<RoleNotFoundException>(() => logic.CreateAsync(new CreateUserRequest(
            "invalid_role_create",
            "123456",
            [int.MaxValue],
            "Invalid Role",
            "Sales",
            0,
            null)));
    }

    [Fact]
    public async Task Create_employee_accepts_SalePos_and_SaleCod_for_manager()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var roleIds = await SaleRoleIds(db);
        var logic = UserServiceTestContext.CreateEmployeeLogic(db);

        var created = await logic.CreateAsync(
            new CreateEmployeeRequest(
                "dual_employee",
                "123456",
                roleIds,
                "Dual Employee",
                "Sales",
                0,
                "0900000000"),
            [PermissionNames.ManageEmployee]);

        Assert.Equal(["SaleCod", "SalePos"], created.Roles.OrderBy(role => role));
    }

    [Fact]
    public async Task Explicit_update_removes_legacy_Sale_and_preserves_all_selected_roles()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var legacySale = await db.Roles.SingleAsync(role => role.RoleName == "Sale");
        var salePos = await db.Roles.SingleAsync(role => role.RoleName == "SalePos");
        var saleCod = await db.Roles.SingleAsync(role => role.RoleName == "SaleCod");
        var manager = await db.Roles.SingleAsync(role => role.RoleName == "Manager");
        var user = await db.Users
            .Include(item => item.UserRoles)
            .SingleAsync(item => item.Username == "sale01");
        user.UserRoles.Add(new() { UserId = user.Id, RoleId = legacySale.Id });
        await db.SaveChangesAsync();
        var logic = UserServiceTestContext.CreateUserLogic(db);

        await logic.UpdateAsync(user.Id, new UpdateUserRequest(
            true,
            [legacySale.Id, salePos.Id, saleCod.Id, manager.Id]));

        var updated = await logic.GetByIdAsync(user.Id);
        Assert.Equal(
            ["Manager", "SaleCod", "SalePos"],
            updated.Roles.OrderBy(role => role));
    }

    [Fact]
    public async Task Explicit_update_replaces_unselected_roles_atomically()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var salePos = await db.Roles.SingleAsync(role => role.RoleName == "SalePos");
        var saleCod = await db.Roles.SingleAsync(role => role.RoleName == "SaleCod");
        var manager = await db.Roles.SingleAsync(role => role.RoleName == "Manager");
        var logic = UserServiceTestContext.CreateUserLogic(db);
        var user = await db.Users.SingleAsync(item => item.Username == "sale01");

        await logic.UpdateAsync(user.Id, new UpdateUserRequest(true, [salePos.Id, saleCod.Id, manager.Id]));
        await logic.UpdateAsync(user.Id, new UpdateUserRequest(true, [salePos.Id, saleCod.Id]));

        var updated = await logic.GetByIdAsync(user.Id);
        Assert.Equal(["SaleCod", "SalePos"], updated.Roles.OrderBy(role => role));
    }

    [Fact]
    public async Task Legacy_sale_review_reports_only_ambiguous_accounts()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var legacySale = await db.Roles.SingleAsync(role => role.RoleName == "Sale");
        var user = await db.Users
            .Include(item => item.UserRoles)
            .SingleAsync(item => item.Username == "sale01");
        user.Username = "ambiguous_review";
        user.UserRoles.Clear();
        user.UserRoles.Add(new() { UserId = user.Id, RoleId = legacySale.Id });
        await db.SaveChangesAsync();
        var logic = UserServiceTestContext.CreateUserLogic(db);

        var report = await logic.GetLegacySaleReviewAsync();

        var item = Assert.Single(report);
        Assert.Equal("ambiguous_review", item.Username);
        Assert.NotNull(item.EmployeeId);
        Assert.Equal(["Sale"], item.Roles);
        Assert.Contains("Không đủ dữ liệu", item.Reason);
    }

    private static async Task<List<int>> SaleRoleIds(UserDbContext db) =>
        await db.Roles
            .Where(role => role.RoleName == "SalePos" || role.RoleName == "SaleCod")
            .OrderBy(role => role.RoleName)
            .Select(role => role.Id)
            .ToListAsync();
}
