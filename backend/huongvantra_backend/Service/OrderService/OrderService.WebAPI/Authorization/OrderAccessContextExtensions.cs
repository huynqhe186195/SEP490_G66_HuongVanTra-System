using System.Security.Claims;
using HuongVanTra.Shared.Auth;
using OrderService.Application.Authorization;

namespace OrderService.WebAPI.Authorization;

public static class OrderAccessContextExtensions
{
    public static OrderAccessContext CreateOrderAccessContext(this ClaimsPrincipal user)
    {
        var canViewAll = user.HasPermission(PermissionNames.ManageEmployee)
            || user.HasPermission(PermissionNames.ManageRole)
            || user.HasPermission(PermissionNames.ViewAllCustomers);

        return new OrderAccessContext(
            user.GetUserId(),
            canViewAll,
            CanViewAllCodOrders: user.HasPermission(PermissionNames.CreateCodOrder),
            CanViewOwnOrders: user.HasPermission(PermissionNames.CreatePosOrder));
    }
}
