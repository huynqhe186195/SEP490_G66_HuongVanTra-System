using System.Reflection;
using System.Security.Claims;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using ProductService.WebAPI.Controllers;
using Xunit;

namespace ProductService.Application.Tests;

public class CatalogSyncAuthorizationTests
{
    [Fact]
    public void PendingAndSyncEndpoints_RequireCreatePosOrderPermission()
    {
        AssertCreatePosPolicy(nameof(CatalogSyncController.GetPending));
        AssertCreatePosPolicy(nameof(CatalogSyncController.Sync));
    }

    public static TheoryData<string, string[], bool> CatalogSyncActors => new()
    {
        { "SalePos", [PermissionNames.CreatePosOrder], true },
        { "SalePos+SaleCod", [PermissionNames.CreatePosOrder, PermissionNames.CreateCodOrder], true },
        { "Sale", [PermissionNames.CreatePosOrder], true },
        { "Manager", [PermissionNames.CreatePosOrder], true },
        { "Admin", PermissionNames.All, true },
        { "SaleCod", [PermissionNames.CreateCodOrder, PermissionNames.VerifyCod], false },
    };

    [Theory]
    [MemberData(nameof(CatalogSyncActors))]
    public async Task CreatePosOrderPolicy_EnforcesExpectedActorAccess(
        string _,
        string[] permissions,
        bool expectedAllowed)
    {
        var identity = new ClaimsIdentity(
            permissions.Select(permission => new Claim("permission", permission)),
            authenticationType: "test");
        var requirement = new PermissionRequirement(PermissionNames.CreatePosOrder);
        var context = new AuthorizationHandlerContext(
            [requirement],
            new ClaimsPrincipal(identity),
            resource: null);

        await new PermissionAuthorizationHandler().HandleAsync(context);

        Assert.Equal(expectedAllowed, context.HasSucceeded);
    }

    private static void AssertCreatePosPolicy(string methodName)
    {
        var method = typeof(CatalogSyncController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"Missing method {methodName}.");
        var attribute = method.GetCustomAttribute<AuthorizeAttribute>()
            ?? throw new InvalidOperationException($"Missing AuthorizeAttribute on {methodName}.");

        Assert.Equal(PermissionNames.CreatePosOrder, attribute.Policy);
        Assert.Null(attribute.Roles);
    }
}
