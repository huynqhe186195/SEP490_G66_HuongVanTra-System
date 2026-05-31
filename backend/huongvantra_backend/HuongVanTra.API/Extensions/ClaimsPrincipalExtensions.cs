using System.Security.Claims;
using HuongVanTra.Core.Authorization;

namespace HuongVanTra.API.Extensions {
    public static class ClaimsPrincipalExtensions {
        public static int? GetUserId(this ClaimsPrincipal principal) {
            var subject = principal.FindFirstValue("sub")
                ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);

            return int.TryParse(subject, out var userId) ? userId : null;
        }

        public static int? GetEmployeeId(this ClaimsPrincipal principal) {
            var employeeId = principal.FindFirstValue(AppClaims.EmployeeId);
            return int.TryParse(employeeId, out var id) ? id : null;
        }

        public static IReadOnlyList<string> GetRoles(this ClaimsPrincipal principal) {
            return principal.FindAll(AppClaims.Role)
                .Select(claim => claim.Value)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public static bool IsInAppRole(this ClaimsPrincipal principal, string role) {
            return principal.GetRoles().Contains(role, StringComparer.OrdinalIgnoreCase);
        }

        public static bool HasModule(this ClaimsPrincipal principal, string module) {
            return RolePermissions.HasModule(principal.GetRoles(), module);
        }
    }
}
