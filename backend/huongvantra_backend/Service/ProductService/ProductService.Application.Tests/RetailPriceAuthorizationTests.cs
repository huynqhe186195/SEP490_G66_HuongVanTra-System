using System.Reflection;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using ProductService.WebAPI.Controllers;
using Xunit;

namespace ProductService.Application.Tests;

public class RetailPriceAuthorizationTests
{
    [Fact]
    public void DirectRetailPriceUpdate_RequiresManagerCatalogPermission()
    {
        var method = typeof(ProductSkusController).GetMethod(nameof(ProductSkusController.UpdateRetailPrice))
            ?? throw new InvalidOperationException("Missing ProductSkusController.UpdateRetailPrice.");
        var authorize = method.GetCustomAttribute<AuthorizeAttribute>()
            ?? throw new InvalidOperationException("Missing authorization on direct retail price update.");

        Assert.Equal(PermissionNames.ManageCatalog, authorize.Policy);
        Assert.NotEqual(PermissionNames.ManageCost, authorize.Policy);
    }
}
