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
    public const string CooperativeOwnerUsername = "owner01";
    public const string CooperativeOwnerRoleName = "CooperativeOwner";
    public const string DemoPassword = "123456";

    private static readonly (string RoleName, string Description, string[] Permissions)[] DefaultRoles =
    [
        ("SalePos", "Nhân viên bán hàng quầy (POS)",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreatePosOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer
        ]),
        ("SaleCod", "Nhân viên bán / thu COD",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreateCodOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer,
            PermissionNames.VerifyCod
        ]),
        // Legacy: giữ để tương thích dữ liệu cũ; quyền gần SalePos (không VERIFY_COD).
        ("Sale", "Nhân viên kinh doanh (legacy → dùng SalePos/SaleCod)",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreatePosOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer
        ]),
        ("Warehouse", "Thủ kho Kho tổng",
        [PermissionNames.ViewOrder, PermissionNames.ManageCatalog]),
        ("Accountant", "Kế toán",
        [PermissionNames.ViewOrder, PermissionNames.ViewAllCustomers]),
        ("Manager", "Quản lý",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreatePosOrder,
            PermissionNames.CreateCodOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewAllCustomers,
            PermissionNames.ManageEmployee,
            PermissionNames.CreateCustomer,
            PermissionNames.ViewCustomer,
            PermissionNames.VerifyCod
        ]),
        (CooperativeOwnerRoleName, "Chủ hợp tác xã",
        [
            PermissionNames.ManageEmployee, PermissionNames.ViewAllCustomers, PermissionNames.ViewCustomer, 
            PermissionNames.ViewOrder, PermissionNames.CreateCustomer, PermissionNames.ApprovePrice, 
            PermissionNames.ApproveContract, PermissionNames.ManageBusinessPolicy
        ])
    ];

    private static readonly (string Username, string FullName, string Department, string RoleName)[] DemoUsers =
    [
        ("sale01", "Nguyen Van Sale Quay", "Sales", "SalePos"),
        ("sale_cod01", "Tran Thi Sale COD", "Sales", "SaleCod"),
        ("manager01", "Tran Thi Manager", "Operations", "Manager"),
        (CooperativeOwnerUsername, "Nguyen Van Chu HTX", "Board", CooperativeOwnerRoleName),
        ("accountant01", "Le Thi Ke Toan", "Accounting", "Accountant")
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

        await SyncDemoUserPrimaryRoleAsync(context);
    }

    private static async Task SeedPermissionsAsync(UserDbContext context)
    {
        var existing = await context.Permissions
            .Where(p => !p.IsDeleted)
            .Select(p => p.PermissionCode)
            .ToListAsync();

        var missing = PermissionNames.All
            .Where(name => !existing.Contains(name))
            .Select(name => new Permission { PermissionCode = name, PermissionName = name })
            .ToList();

        if (missing.Count == 0) return;

        context.Permissions.AddRange(missing);
        await context.SaveChangesAsync();
    }

    private static async Task<Role> SeedAdminRoleAsync(UserDbContext context)
    {
        return await SeedRoleAsync(context, AdminRoleName, "Quản trị kỹ thuật",
        [
            PermissionNames.ManageUser,
            PermissionNames.ManageRole
        ]);
    }

    private static async Task<Role> SeedRoleAsync(
        UserDbContext context,
        string roleName,
        string description,
        string[] permissionNames)
    {
        var permissions = await context.Permissions
            .Where(p => !p.IsDeleted && permissionNames.Contains(p.PermissionCode))
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
        var targetPermissionIds = permissions.Select(p => p.Id).ToHashSet();
        var staleAssignments = role.RolePermissions
            .Where(rp => !targetPermissionIds.Contains(rp.PermissionId))
            .ToList();
        foreach (var stale in staleAssignments)
            role.RolePermissions.Remove(stale);

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

    /// <summary>
    /// Đồng bộ các demo account có mapping xác định. Chỉ bỏ role Sale legacy,
    /// không xóa các role phụ hợp lệ đã được quản trị viên gán.
    /// </summary>
    private static async Task SyncDemoUserPrimaryRoleAsync(UserDbContext context)
    {
        var desired = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["sale01"] = "SalePos",
            ["sale_cod01"] = "SaleCod",
            ["manager01"] = "Manager",
            ["accountant01"] = "Accountant",
        };

        var legacySaleRole = await context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == "Sale" && !r.IsDeleted);

        foreach (var (username, roleName) in desired)
        {
            var user = await context.Users
                .Include(u => u.UserRoles)
                .FirstOrDefaultAsync(u => u.Username == username && !u.IsDeleted);
            if (user is null) continue;

            var role = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName && !r.IsDeleted);
            if (role is null) continue;

            if (!user.UserRoles.Any(ur => ur.RoleId == role.Id))
                user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });

            if (legacySaleRole is not null)
            {
                var legacyAssignments = user.UserRoles
                    .Where(ur => ur.RoleId == legacySaleRole.Id)
                    .ToList();
                foreach (var legacyAssignment in legacyAssignments)
                    user.UserRoles.Remove(legacyAssignment);
            }
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();
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
