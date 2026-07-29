using UserService.Domain.Constants;
using UserService.Domain.Exceptions;

namespace UserService.Application.Authorization;

public static class StaffManagementScope
{
    public const string SaleRoleName = "Sale";
    public const string SalePosRoleName = "SalePos";
    public const string SaleCodRoleName = "SaleCod";

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
            return [SalePosRoleName, SaleCodRoleName];

        return [];
    }

    public static bool IsSaleRole(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName) && SaleFamilyRoles.Contains(roleName);

    public static bool CanViewEmployee(IEnumerable<string> permissions, IEnumerable<string> employeeRoles)
    {
        var roles = employeeRoles.Where(r => !string.IsNullOrWhiteSpace(r)).ToList();
        if (roles.Count == 0) return false;

        // Admin (trang Nhân sự): chỉ quản lý Manager.
        if (IsSystemAdmin(permissions))
            return roles.All(role => AdminAssignableRoles.Contains(role));

        // Manager: chỉ Sale (SalePos/SaleCod/Sale legacy)
        if (IsBranchManager(permissions))
            return roles.Any(IsSaleRole);

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
