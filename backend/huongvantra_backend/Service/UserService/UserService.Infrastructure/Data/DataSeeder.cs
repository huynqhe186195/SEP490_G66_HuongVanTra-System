using Microsoft.EntityFrameworkCore;
using UserService.Domain.Constants;
using UserService.Domain.Entities;
using UserService.Domain.Enums;

namespace UserService.Infrastructure.Data;

public static class DataSeeder
{
    public const string AdminUsername = "admin";
    public const string AdminPassword = "123456";
    public const string AdminRoleName = "Admin";
    public const string DemoPassword = "123456";

    private static readonly (string RoleName, string Description, string[] Permissions)[] DefaultRoles =
    [
        ("Sale", "Nhân viên kinh doanh",
        [PermissionNames.CreateOrder, PermissionNames.ViewOrder, PermissionNames.CreateCustomer, PermissionNames.ViewCustomer]),
        ("Warehouse", "Nhân viên kho",
        [PermissionNames.ViewOrder]),
        ("Accountant", "Kế toán",
        [PermissionNames.ViewOrder, PermissionNames.ViewAllCustomers]),
        ("Manager", "Quản lý",
        [PermissionNames.ViewOrder, PermissionNames.ViewAllCustomers, PermissionNames.ManageEmployee,
         PermissionNames.CreateCustomer, PermissionNames.ViewCustomer])
    ];

    private static readonly (string Username, string FullName, string Department, string RoleName)[] DemoUsers =
    [
        ("sale01", "Nguyen Van Sale", "Sales", "Sale")
    ];

    public static async Task SeedAsync(UserDbContext context)
    {
        await SeedPermissionsAsync(context);
        var adminRole = await SeedAdminRoleAsync(context);
        await SeedAdminUserAsync(context, adminRole);

        foreach (var (roleName, description, permissions) in DefaultRoles)
            await SeedRoleAsync(context, roleName, description, permissions);

        foreach (var (username, fullName, department, roleName) in DemoUsers)
            await SeedDemoUserAsync(context, username, fullName, department, roleName);
    }

    private static async Task SeedPermissionsAsync(UserDbContext context)
    {
        var existing = await context.Permissions
            .Where(p => !p.IsDeleted)
            .Select(p => p.PermissionName)
            .ToListAsync();

        var missing = PermissionNames.All
            .Where(name => !existing.Contains(name))
            .Select(name => new Permission { PermissionName = name })
            .ToList();

        if (missing.Count == 0) return;

        context.Permissions.AddRange(missing);
        await context.SaveChangesAsync();
    }

    private static async Task<Role> SeedAdminRoleAsync(UserDbContext context)
    {
        var permissions = await context.Permissions.Where(p => !p.IsDeleted).ToListAsync();
        return await SeedRoleAsync(context, AdminRoleName, "System administrator",
            permissions.Select(p => p.PermissionName).ToArray());
    }

    private static async Task<Role> SeedRoleAsync(
        UserDbContext context,
        string roleName,
        string description,
        string[] permissionNames)
    {
        var permissions = await context.Permissions
            .Where(p => !p.IsDeleted && permissionNames.Contains(p.PermissionName))
            .ToListAsync();

        var role = await context.Roles
            .Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.RoleName == roleName && !r.IsDeleted);

        if (role is null)
        {
            role = new Role
            {
                RoleName = roleName,
                Description = description,
                RolePermissions = permissions
                    .Select(p => new RolePermission { PermissionId = p.Id })
                    .ToList()
            };
            context.Roles.Add(role);
            await context.SaveChangesAsync();
            return role;
        }

        role.Description = description;
        var assignedIds = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();
        foreach (var permission in permissions.Where(p => !assignedIds.Contains(p.Id)))
            role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permission.Id });

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();

        return role;
    }

    private static async Task SeedAdminUserAsync(UserDbContext context, Role adminRole)
    {
        await SeedUserAsync(context, AdminUsername, "System Administrator", "IT", adminRole, 0);
    }

    private static async Task SeedDemoUserAsync(
        UserDbContext context,
        string username,
        string fullName,
        string department,
        string roleName)
    {
        var role = await context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == roleName && !r.IsDeleted);
        if (role is null) return;

        await SeedUserAsync(context, username, fullName, department, role, 10_000_000);
    }

    private static async Task SeedUserAsync(
        UserDbContext context,
        string username,
        string fullName,
        string department,
        Role role,
        decimal salary)
    {
        if (await context.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == username))
            return;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(DemoPassword),
            IsActive = true
        };
        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });

        context.Users.Add(user);
        context.Employees.Add(new Employee
        {
            UserId = user.Id,
            FullName = fullName,
            Department = department,
            ActualSalary = salary,
            Status = EmployeeStatus.Active
        });

        await context.SaveChangesAsync();
    }
}
