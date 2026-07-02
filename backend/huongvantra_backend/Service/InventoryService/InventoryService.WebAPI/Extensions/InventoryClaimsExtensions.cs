using System.Security.Claims;
using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;

namespace InventoryService.WebAPI.Extensions;

public static class InventoryClaimsExtensions
{
    public static CreatorSnapshot ToCreatorSnapshot(this ClaimsPrincipal principal)
    {
        return new CreatorSnapshot(
            principal.GetUserId(),
            GetFirstClaim(principal, "full_name", "name", ClaimTypes.Name),
            principal.GetRoles().FirstOrDefault(role => !string.IsNullOrWhiteSpace(role)));
    }

    private static string? GetFirstClaim(ClaimsPrincipal principal, params string[] claimTypes)
    {
        foreach (var claimType in claimTypes)
        {
            var value = principal.FindFirstValue(claimType)?.Trim();
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        return null;
    }
}
