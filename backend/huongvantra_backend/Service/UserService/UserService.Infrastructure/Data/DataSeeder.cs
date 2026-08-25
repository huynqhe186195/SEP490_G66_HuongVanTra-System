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
        ("SalePos", "Nhân viên bán hàng quầy (POS)",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreatePosOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer,
            PermissionNames.ViewCatalog,
        ]),
        ("SaleCod", "Nhân viên bán / thu COD",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreateCodOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer,
            PermissionNames.VerifyCod,
            PermissionNames.ViewCatalog,
        ]),
        ("Sale", "Nhân viên kinh doanh (legacy → dùng SalePos/SaleCod)",
        [
            PermissionNames.CreateOrder,
            PermissionNames.CreatePosOrder,
            PermissionNames.ViewOrder,
            PermissionNames.ViewCustomer,
            PermissionNames.ViewCatalog,
        ]),
        ("Warehouse", "Thủ kho Kho tổng",
        [
            PermissionNames.ViewOrder,
            PermissionNames.ViewCatalog,
            // Thủ kho lập yêu cầu tạo hàng hóa (POST/PUT/submit product-creation-requests
            // đều gác bằng policy này); Manager giữ ApproveProductRequest để duyệt.
            PermissionNames.ManageCatalog,
            PermissionNames.MonitorOutbox,
            PermissionNames.ViewInventory,
            PermissionNames.OperateWarehouse,
            PermissionNames.SubmitWarehouseReport,
            PermissionNames.ViewProductRequest,
            PermissionNames.ViewCost,
            PermissionNames.ShipOrder,
            PermissionNames.ApproveShelfReplenishment,
            PermissionNames.PerformReturnInspection,
            PermissionNames.ManageStockThreshold,
            PermissionNames.ManageSuppliers,
            PermissionNames.ManageSupplierProduct,
        ]),
        ("Accountant", "Kế toán",
        [
            PermissionNames.ViewOrder,
            PermissionNames.ViewAllCustomers,
            PermissionNames.ViewInventory,
            PermissionNames.ManageCost,
            PermissionNames.ViewCost,
            PermissionNames.ViewCatalog,
            PermissionNames.ViewCustomer,
            PermissionNames.CreateOrder,
            PermissionNames.ManageCorporateCustomer,
            PermissionNames.CreateB2BOrder,
            PermissionNames.ConfirmB2BDelivery,
        ]),
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
            PermissionNames.VerifyCod,
            PermissionNames.ApproveContract,
            PermissionNames.MonitorOutbox,
            PermissionNames.ViewInventory,
            PermissionNames.ApproveInventory,
            PermissionNames.RejectStockDeduct,
            PermissionNames.ViewCost,
            PermissionNames.ViewCatalog,
            PermissionNames.ManageCatalog,
            PermissionNames.SyncCatalog,
            PermissionNames.ManageTaxonomy,
            PermissionNames.ViewProductRequest,
            PermissionNames.ApproveProductRequest,
            PermissionNames.CreateShelfReplenishment,
            PermissionNames.ManageStockThreshold,
            PermissionNames.PerformReturnInspection,
            PermissionNames.ManageCorporateCustomer,
            PermissionNames.CreateB2BOrder,
            PermissionNames.ShipOrder,
            PermissionNames.ConfirmB2BDelivery,
            PermissionNames.ManageSuppliers,
            PermissionNames.DeleteSupplier,
            PermissionNames.ManageSupplierProduct,
        ])
    ];

    private static readonly (string Username, string FullName, string Department, string RoleName)[] DemoUsers =
    [
        ("sale01", "Nguyen Van Sale Quay", "Sales", "SalePos"),
        ("sale_cod01", "Tran Thi Sale COD", "Sales", "SaleCod"),
        ("manager01", "Tran Thi Manager", "Operations", "Manager"),
        ("accountant01", "Le Thi Ke Toan", "Accounting", "Accountant"),
        ("warehouse01", "Pham Van Thu Kho", "Warehouse", "Warehouse")
    ];

    private static readonly (Guid Id, string Name, ShiftArea Area, TimeSpan Start, TimeSpan End, int Capacity, string Color, int SortOrder)[] DefaultShiftTemplates =
    [
        (Guid.Parse("aaaaaaaa-0001-4000-8000-000000000001"), "Ca 1", ShiftArea.Shelf,
            new TimeSpan(8, 0, 0), new TimeSpan(12, 0, 0), 2, "#356647", 1),
        (Guid.Parse("aaaaaaaa-0001-4000-8000-000000000002"), "Ca 2", ShiftArea.Shelf,
            new TimeSpan(13, 0, 0), new TimeSpan(21, 0, 0), 2, "#4e7f5e", 2),
        (Guid.Parse("aaaaaaaa-0001-4000-8000-000000000003"), "Ca kho", ShiftArea.Warehouse,
            new TimeSpan(8, 0, 0), new TimeSpan(17, 0, 0), 1, "#6b5b4a", 3),
    ];

    public static async Task SeedAsync(UserDbContext context)
    {
        await SeedPermissionsAsync(context);
        var adminRole = await SeedAdminRoleAsync(context);
        await SeedAdminUserAsync(context, adminRole);

        foreach (var (roleName, description, permissions) in DefaultRoles)
            await SeedRoleAsync(context, roleName, description, permissions);

        await RetireObsoleteRolesAsync(context);

        foreach (var (username, fullName, department, roleName) in DemoUsers)
            await SeedDemoUserAsync(context, username, fullName, department, roleName);

        await SyncDemoUserPrimaryRoleAsync(context);
        await SeedShiftTemplatesAsync(context);
    }

    /// <summary>
    /// Vai trò legacy không còn dùng trong HVTPOSIMS 1 cửa hàng — ẩn khỏi IAM.
    /// </summary>
    private static readonly string[] ObsoleteRoleNames = ["CooperativeOwner"];

    private static async Task RetireObsoleteRolesAsync(UserDbContext context)
    {
        var obsolete = await context.Roles
            .Include(r => r.UserRoles)
            .Where(r => ObsoleteRoleNames.Contains(r.RoleName) && !r.IsDeleted)
            .ToListAsync();

        if (obsolete.Count > 0)
        {
            foreach (var role in obsolete)
            {
                if (role.UserRoles.Count > 0)
                    context.UserRoles.RemoveRange(role.UserRoles);

                role.IsDeleted = true;
                role.Description = string.IsNullOrWhiteSpace(role.Description)
                    ? "Đã ngừng dùng"
                    : $"{role.Description.Trim()} — đã ngừng dùng";
            }
        }

        // Tài khoản demo legacy gắn CooperativeOwner.
        var legacyOwners = await context.Users
            .Include(u => u.Employee)
            .Include(u => u.UserRoles)
            .Where(u => !u.IsDeleted && u.Username == "owner01")
            .ToListAsync();

        foreach (var user in legacyOwners)
        {
            if (user.UserRoles.Count > 0)
                context.UserRoles.RemoveRange(user.UserRoles);
            user.IsDeleted = true;
            user.IsActive = false;
            if (user.Employee is not null)
                user.Employee.IsDeleted = true;
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();
    }

    // Chỉ Sale (SalePos/SaleCod) cần đăng ký ca — ca kho (Warehouse) bị vô hiệu hoá.
    private static readonly HashSet<Guid> InactiveShiftTemplateIds =
    [
        Guid.Parse("aaaaaaaa-0001-4000-8000-000000000003"), // Ca kho
    ];

    private static async Task SeedShiftTemplatesAsync(UserDbContext context)
    {
        foreach (var (id, name, area, start, end, capacity, color, sortOrder) in DefaultShiftTemplates)
        {
            var isActive = !InactiveShiftTemplateIds.Contains(id);
            var existing = await context.ShiftTemplates.FirstOrDefaultAsync(t => t.Id == id);
            if (existing is not null)
            {
                if (existing.IsActive != isActive)
                    existing.IsActive = isActive;
                if (!string.Equals(existing.Name, name, StringComparison.Ordinal))
                    existing.Name = name;
                continue;
            }

            context.ShiftTemplates.Add(new ShiftTemplate
            {
                Id = id,
                Name = name,
                Area = area,
                StartTime = start,
                EndTime = end,
                Capacity = capacity,
                Color = color,
                SortOrder = sortOrder,
                IsActive = isActive
            });
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();

        // Đổi tên legacy trên mọi template để lịch làm việc /my-shifts đồng bộ.
        var legacyRenames = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Ca sáng quầy"] = "Ca 1",
            ["Ca chiều quầy"] = "Ca 2",
            ["Ca sáng"] = "Ca 1",
            ["Ca chiều"] = "Ca 2",
        };
        var templates = await context.ShiftTemplates.Where(t => !t.IsDeleted).ToListAsync();
        foreach (var template in templates)
        {
            if (legacyRenames.TryGetValue(template.Name, out var renamed)
                && !string.Equals(template.Name, renamed, StringComparison.Ordinal))
            {
                template.Name = renamed;
            }
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();
    }

    private static async Task SeedPermissionsAsync(UserDbContext context)
    {
        var existing = await context.Permissions
            .Where(p => !p.IsDeleted)
            .ToListAsync();

        foreach (var permission in existing.Where(p => string.IsNullOrWhiteSpace(p.PermissionCode)))
            permission.PermissionCode = permission.PermissionName;

        var existingCodes = existing
            .Select(p => string.IsNullOrWhiteSpace(p.PermissionCode) ? p.PermissionName : p.PermissionCode)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var missing = PermissionNames.All
            .Where(name => !existingCodes.Contains(name))
            .Select(name => new Permission { PermissionName = name, PermissionCode = name })
            .ToList();

        if (missing.Count == 0) return;

        context.Permissions.AddRange(missing);
        await context.SaveChangesAsync();
    }

    private static async Task<Role> SeedAdminRoleAsync(UserDbContext context)
    {
        // Admin chỉ IAM + giám sát (xem), không thao tác nghiệp vụ bán hàng / kho.
        return await SeedRoleAsync(
            context,
            AdminRoleName,
            "Quản trị hệ thống — giám sát và quản lý nhân sự/phân quyền",
            [
                PermissionNames.ManageRole,
                PermissionNames.ManageUser,
                PermissionNames.ManageEmployee,
                PermissionNames.ViewOrder,
                PermissionNames.ViewCustomer,
                PermissionNames.ViewAllCustomers,
                PermissionNames.ViewCatalog,
                PermissionNames.ApprovePrice,
                PermissionNames.ApproveContract,
                PermissionNames.ManageBusinessPolicy,
                PermissionNames.MonitorOutbox,
                PermissionNames.ViewInventory,
                PermissionNames.RejectStockDeduct,
                PermissionNames.ViewCost,
                PermissionNames.ViewProductRequest,
                PermissionNames.ApproveProductRequest,
                PermissionNames.SyncCatalog,
            ]);
    }

    private static async Task<Role> SeedRoleAsync(
        UserDbContext context,
        string roleName,
        string description,
        string[] permissionNames)
    {
        var permissions = await context.Permissions
            .Where(p => !p.IsDeleted
                && (permissionNames.Contains(p.PermissionCode) || permissionNames.Contains(p.PermissionName)))
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
            ["warehouse01"] = "Warehouse",
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
