using System.Security.Claims;
using HuongVanTra.Shared.Auth;
using ProductService.Application.DTOs.Requests;

namespace ProductService.WebAPI.Extensions;

public static class ProductClaimsExtensions
{
    public static ProductApprovalActorSnapshot ToProductApprovalActorSnapshot(this ClaimsPrincipal principal)
    {
        return new ProductApprovalActorSnapshot(
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

