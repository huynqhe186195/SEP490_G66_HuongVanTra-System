using System.Security.Claims;

namespace HuongVanTra.Shared.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        return Guid.TryParse(value, out var id) ? id : Guid.Empty;
    }

    public static string GetUsername(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    /// <summary>
    /// Ưu tiên họ tên nhân viên (full_name / name), sau đó username.
    /// </summary>
    public static string? GetDisplayName(this ClaimsPrincipal principal)
    {
        foreach (var claimType in new[] { "full_name", "name", ClaimTypes.Name, "username", "unique_name" })
        {
            var value = principal.FindFirstValue(claimType)?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        return null;
    }

    public static IEnumerable<string> GetRoles(this ClaimsPrincipal principal) =>
        principal.FindAll(ClaimTypes.Role)
            .Concat(principal.FindAll("role"))
            .Select(c => c.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase);

    public static IEnumerable<string> GetPermissions(this ClaimsPrincipal principal) =>
        principal.FindAll("permission").Select(c => c.Value);

    public static bool HasPermission(this ClaimsPrincipal principal, string permission) =>
        principal.HasClaim("permission", permission);
}
