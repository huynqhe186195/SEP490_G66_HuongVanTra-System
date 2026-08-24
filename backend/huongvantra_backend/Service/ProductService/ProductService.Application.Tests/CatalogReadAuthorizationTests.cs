using System.Reflection;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using ProductService.WebAPI.Controllers;
using Xunit;

namespace ProductService.Application.Tests;

public class CatalogReadAuthorizationTests
{
    [Theory]
    [InlineData(typeof(BrandsController), "GetAll")]
    [InlineData(typeof(BrandsController), "GetById")]
    [InlineData(typeof(CategoriesController), "GetAll")]
    [InlineData(typeof(CategoriesController), "GetById")]
    public void MasterDataReads_RequireCatalogViewPermission(Type controllerType, string action)
    {
        var method = controllerType.GetMethod(action)
            ?? throw new InvalidOperationException($"Missing {controllerType.Name}.{action}.");
        var authorize = method.GetCustomAttribute<AuthorizeAttribute>()
            ?? throw new InvalidOperationException($"Missing authorization on {controllerType.Name}.{action}.");

        Assert.Equal(PermissionNames.ViewCatalogAccess, authorize.Policy);
    }
}
