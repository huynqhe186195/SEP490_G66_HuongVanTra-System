using System.Security.Claims;
using ProductService.Application;

namespace ProductService.WebAPI.Extensions;

public static class CatalogScopeExtensions
{
    /// <summary>Chỉ Thủ kho xem master catalog; mọi role khác (Sale, Admin, …) xem catalog cửa hàng đã đồng bộ.</summary>
    public static CatalogViewScope GetCatalogViewScope(this ClaimsPrincipal user) =>
        user.IsInRole("Warehouse")
            ? CatalogViewScope.Warehouse
            : CatalogViewScope.Store;
}
