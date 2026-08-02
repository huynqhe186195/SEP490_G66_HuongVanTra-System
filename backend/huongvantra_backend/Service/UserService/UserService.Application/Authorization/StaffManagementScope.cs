using UserService.Domain.Constants;
using UserService.Domain.Exceptions;

namespace UserService.Application.Authorization;

public static class StaffManagementScope
{
    public const string AdminRoleName = "Admin";
    public const string ManagerRoleName = "Manager";
    public const string SaleRoleName = "Sale";
    public const string SalePosRoleName = "SalePos";
    public const string SaleCodRoleName = "SaleCod";
    public const string WarehouseRoleName = "Warehouse";
    public const string AccountantRoleName = "Accountant";

    private static readonly HashSet<string> AdminAssignableRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Manager",
    };

    private static readonly HashSet<string> SaleFamilyRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        SaleRoleName,
        SalePosRoleName,
        SaleCodRoleName,
    };

    /// <summary>
    /// Vai trò Manager được phép gán khi tạo/sửa nhân sự chi nhánh.
    /// </summary>
    private static readonly HashSet<string> ManagerAssignableRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        SalePosRoleName,
        SaleCodRoleName,
        WarehouseRoleName,
        AccountantRoleName,
    };

    /// <summary>
    /// Vai trò Manager được phép xem/quản lý (gồm Sale legacy).
    /// </summary>
    private static readonly HashSet<string> ManagerViewableRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        SaleRoleName,
        SalePosRoleName,
        SaleCodRoleName,
        WarehouseRoleName,
        AccountantRoleName,
    };

    public static bool IsAdminRoleName(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName)
        && string.Equals(roleName, AdminRoleName, StringComparison.OrdinalIgnoreCase);

    public static bool HasAdminRole(IEnumerable<string>? roleNames) =>
        roleNames is not null && roleNames.Any(IsAdminRoleName);

    /// <summary>
    /// Tài khoản Admin không bị khóa / ngừng sử dụng qua thao tác IAM thường.
    /// </summary>
    public static void EnsureAdminAccountNotDisabled(IEnumerable<string> currentRoles)
    {
        if (HasAdminRole(currentRoles))
        {
            throw new UserValidationException(
                "Tài khoản Quản trị viên thuộc nhóm đặc quyền: không khóa hoặc ngừng sử dụng trên trang này.");
        }
    }

    /// <summary>
    /// Tài khoản Admin chỉ xem trên IAM — không sửa / gán-gỡ role qua thao tác thường.
    /// </summary>
    public static void EnsureAdminAccountNotMutated(IEnumerable<string> currentRoles)
    {
        if (HasAdminRole(currentRoles))
        {
            throw new UserValidationException(
                "Tài khoản Quản trị viên thuộc nhóm đặc quyền: trên trang này chỉ xem thông tin. Thay đổi cần quy trình vận hành riêng.");
        }
    }

    /// <summary>
    /// Không cho gỡ vai trò Admin khỏi tài khoản đang mang Admin qua IAM thường.
    /// </summary>
    public static void EnsureAdminRoleNotRemoved(
        IEnumerable<string> currentRoles,
        IEnumerable<string> nextRoles)
    {
        if (HasAdminRole(currentRoles) && !HasAdminRole(nextRoles))
        {
            throw new UserValidationException(
                "Không thể gỡ vai trò Quản trị viên qua thao tác thường. Vui lòng dùng quy trình vận hành riêng.");
        }
    }

    public static bool IsSystemAdmin(IEnumerable<string> permissions) =>
        permissions.Contains(PermissionNames.ManageRole, StringComparer.Ordinal);

    /** Quản lý toàn bộ tài khoản (/admin/users) — không giới hạn phạm vi Sale/Staff. */
    public static bool HasFullUserManagement(IEnumerable<string> permissions) =>
        permissions.Contains(PermissionNames.ManageUser, StringComparer.Ordinal);

    public static bool IsBranchManager(IEnumerable<string> permissions) =>
        permissions.Contains(PermissionNames.ManageEmployee, StringComparer.Ordinal)
        && !IsSystemAdmin(permissions);

    public static IReadOnlyList<string> GetAssignableRoleNames(IEnumerable<string> permissions)
    {
        if (IsSystemAdmin(permissions))
            return AdminAssignableRoles.ToList();

        if (IsBranchManager(permissions))
            return ManagerAssignableRoles.OrderBy(name => name, StringComparer.OrdinalIgnoreCase).ToList();

        return [];
    }

    public static bool IsSaleRole(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName) && SaleFamilyRoles.Contains(roleName);

    public static bool IsManagerRole(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName)
        && string.Equals(roleName, ManagerRoleName, StringComparison.OrdinalIgnoreCase);

    public static bool IsManagerViewableRole(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName) && ManagerViewableRoles.Contains(roleName);

    public static bool CanViewEmployee(IEnumerable<string> permissions, IEnumerable<string> employeeRoles)
    {
        var roles = employeeRoles.Where(r => !string.IsNullOrWhiteSpace(r)).ToList();
        if (roles.Count == 0) return false;

        // Admin (trang Nhân sự): chỉ quản lý Manager.
        if (IsSystemAdmin(permissions))
            return roles.All(role => AdminAssignableRoles.Contains(role));

        // Manager: Sale (SalePos/SaleCod/Sale legacy) + Kế toán + Thủ kho.
        if (IsBranchManager(permissions))
            return roles.All(IsManagerViewableRole);

        return false;
    }

    public static void EnsureCanAssignRoles(IEnumerable<string> permissions, IEnumerable<string> roleNames)
    {
        var assignable = GetAssignableRoleNames(permissions).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var requested = roleNames.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        if (requested.Count == 0)
            throw new UserValidationException("Vui lòng chọn vai trò nhân viên.");

        if (requested.Any(role => !assignable.Contains(role)))
            throw new ForbiddenException("Bạn không có quyền gán vai trò này.");
    }

    public static void EnsureCanManageEmployee(IEnumerable<string> permissions, IEnumerable<string> employeeRoles)
    {
        if (!CanViewEmployee(permissions, employeeRoles))
            throw new ForbiddenException("Bạn không có quyền quản lý nhân viên này.");
    }
}
