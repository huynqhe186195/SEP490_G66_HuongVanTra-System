using System.Security.Claims;

namespace UserService.WebAPI.Extensions;

public static class HttpUserContext
{
    public static IReadOnlyList<string> GetPermissions(this ClaimsPrincipal user) =>
        user.Claims
            .Where(claim => claim.Type == "permission")
            .Select(claim => claim.Value)
            .ToList();
}
