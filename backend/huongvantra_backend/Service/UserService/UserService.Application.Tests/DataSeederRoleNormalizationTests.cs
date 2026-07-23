using Microsoft.EntityFrameworkCore;
using UserService.Domain.Constants;
using UserService.Domain.Entities;
using UserService.Domain.Enums;
using UserService.Infrastructure.Data;

namespace UserService.Application.Tests;

public class DataSeederRoleNormalizationTests
{
    [Fact]
    public async Task Seed_is_idempotent_for_permissions_roles_and_assignments()
    {
        await using var db = UserServiceTestContext.CreateDb();

        await DataSeeder.SeedAsync(db);
        var permissionCount = await db.Permissions.CountAsync();
        var rolePermissionCount = await db.RolePermissions.CountAsync();
        var userRoleCount = await db.UserRoles.CountAsync();

        await DataSeeder.SeedAsync(db);

        Assert.Equal(permissionCount, await db.Permissions.CountAsync());
        Assert.Equal(rolePermissionCount, await db.RolePermissions.CountAsync());
        Assert.Equal(userRoleCount, await db.UserRoles.CountAsync());
        var permissionNames = await db.Permissions
            .Select(permission => permission.PermissionName)
            .ToListAsync();
        var userRoles = await db.UserRoles
            .Select(userRole => new { userRole.UserId, userRole.RoleId })
            .ToListAsync();
        Assert.Equal(
            permissionNames.Count,
            permissionNames.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(
            userRoles.Count,
            userRoles.DistinctBy(userRole => new { userRole.UserId, userRole.RoleId }).Count());
    }

    [Fact]
    public async Task Deterministic_sale01_mapping_adds_SalePos_removes_only_legacy_Sale()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var sale = await Role(db, "Sale");
        var salePos = await Role(db, "SalePos");
        var manager = await Role(db, "Manager");
        var user = await DemoUser(db, "sale01");

        user.UserRoles.Remove(user.UserRoles.Single(userRole => userRole.RoleId == salePos.Id));
        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = sale.Id });
        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = manager.Id });
        await db.SaveChangesAsync();

        await DataSeeder.SeedAsync(db);

        var roleNames = await UserRoleNames(db, user.Id);
        Assert.Contains("SalePos", roleNames);
        Assert.Contains("Manager", roleNames);
        Assert.DoesNotContain("Sale", roleNames);
    }

    [Fact]
    public async Task Deterministic_sale_cod01_mapping_adds_SaleCod_and_preserves_secondary_role()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var legacySale = await Role(db, "Sale");
        var saleCod = await Role(db, "SaleCod");
        var accountant = await Role(db, "Accountant");
        var user = await DemoUser(db, "sale_cod01");

        user.UserRoles.Remove(user.UserRoles.Single(userRole => userRole.RoleId == saleCod.Id));
        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = legacySale.Id });
        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = accountant.Id });
        await db.SaveChangesAsync();

        await DataSeeder.SeedAsync(db);

        var roleNames = await UserRoleNames(db, user.Id);
        Assert.Contains("SaleCod", roleNames);
        Assert.Contains("Accountant", roleNames);
        Assert.DoesNotContain("Sale", roleNames);
    }

    [Fact]
    public async Task Ambiguous_legacy_sale_is_not_auto_converted()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);
        var legacySale = await Role(db, "Sale");
        var userId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = userId,
            Username = "legacy_ambiguous",
            PasswordHash = "not-used",
            UserRoles = [new UserRole { UserId = userId, RoleId = legacySale.Id }]
        });
        db.Employees.Add(new Employee
        {
            UserId = userId,
            FullName = "Legacy Ambiguous",
            Status = EmployeeStatus.Active
        });
        await db.SaveChangesAsync();

        await DataSeeder.SeedAsync(db);

        Assert.Equal(["Sale"], await UserRoleNames(db, userId));
    }

    [Fact]
    public async Task Sale_family_permissions_are_separated_without_inventory_approval()
    {
        await using var db = UserServiceTestContext.CreateDb();
        await DataSeeder.SeedAsync(db);

        var salePosPermissions = await PermissionNamesForRole(db, "SalePos");
        var saleCodPermissions = await PermissionNamesForRole(db, "SaleCod");
        var legacyPermissions = await PermissionNamesForRole(db, "Sale");

        Assert.Contains(PermissionNames.CreatePosOrder, salePosPermissions);
        Assert.DoesNotContain(PermissionNames.CreateCodOrder, salePosPermissions);
        Assert.DoesNotContain(PermissionNames.VerifyCod, salePosPermissions);
        Assert.Contains(PermissionNames.CreateCodOrder, saleCodPermissions);
        Assert.Contains(PermissionNames.VerifyCod, saleCodPermissions);
        Assert.DoesNotContain(PermissionNames.CreatePosOrder, saleCodPermissions);
        Assert.DoesNotContain(PermissionNames.ManageCatalog, saleCodPermissions);
        Assert.Equal(
            salePosPermissions.OrderBy(value => value),
            legacyPermissions.OrderBy(value => value));
    }

    private static Task<Role> Role(UserDbContext db, string roleName) =>
        db.Roles.SingleAsync(role => role.RoleName == roleName);

    private static Task<User> DemoUser(UserDbContext db, string username) =>
        db.Users
            .Include(user => user.UserRoles)
            .SingleAsync(user => user.Username == username);

    private static async Task<List<string>> UserRoleNames(UserDbContext db, Guid userId) =>
        await db.UserRoles
            .Where(userRole => userRole.UserId == userId)
            .Select(userRole => userRole.Role.RoleName)
            .OrderBy(roleName => roleName)
            .ToListAsync();

    private static async Task<List<string>> PermissionNamesForRole(UserDbContext db, string roleName) =>
        await db.RolePermissions
            .Where(rolePermission => rolePermission.Role.RoleName == roleName)
            .Select(rolePermission => rolePermission.Permission.PermissionName)
            .ToListAsync();
}
