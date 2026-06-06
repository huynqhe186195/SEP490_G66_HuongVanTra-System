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

    public static IEnumerable<string> GetRoles(this ClaimsPrincipal principal) =>
        principal.FindAll(ClaimTypes.Role).Select(c => c.Value);

    public static IEnumerable<string> GetPermissions(this ClaimsPrincipal principal) =>
        principal.FindAll("permission").Select(c => c.Value);

    public static bool HasPermission(this ClaimsPrincipal principal, string permission) =>
        principal.HasClaim("permission", permission);
}
