using UserService.Domain.Entities;

namespace UserService.Application.Authorization;

public static class RoleAssignmentRules
{
    public static IReadOnlyList<Role> Normalize(IEnumerable<Role> roles)
    {
        var normalized = roles
            .GroupBy(role => role.Id)
            .Select(group => group.First())
            .ToList();

        var hasModernSaleRole = normalized.Any(role =>
            string.Equals(role.RoleName, StaffManagementScope.SalePosRoleName, StringComparison.OrdinalIgnoreCase)
            || string.Equals(role.RoleName, StaffManagementScope.SaleCodRoleName, StringComparison.OrdinalIgnoreCase));

        if (hasModernSaleRole)
        {
            normalized.RemoveAll(role =>
                string.Equals(role.RoleName, StaffManagementScope.SaleRoleName, StringComparison.OrdinalIgnoreCase));
        }

        return normalized;
    }

    public static void Replace(User user, IEnumerable<Role> roles)
    {
        var targetRoles = Normalize(roles);
        var targetRoleIds = targetRoles.Select(role => role.Id).ToHashSet();

        var staleAssignments = user.UserRoles
            .Where(userRole => !targetRoleIds.Contains(userRole.RoleId))
            .ToList();
        foreach (var staleAssignment in staleAssignments)
            user.UserRoles.Remove(staleAssignment);

        var assignedRoleIds = user.UserRoles.Select(userRole => userRole.RoleId).ToHashSet();
        foreach (var role in targetRoles.Where(role => !assignedRoleIds.Contains(role.Id)))
        {
            user.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                Role = role
            });
        }
    }
}
