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
    public void PendingAndSyncEndpoints_RequireSyncCatalogPermission()
    {
        AssertSyncCatalogPolicy(nameof(CatalogSyncController.GetPending));
        AssertSyncCatalogPolicy(nameof(CatalogSyncController.Sync));
    }

    public static TheoryData<string, string[], bool> CatalogSyncActors => new()
    {
        { "SalePos", [PermissionNames.SyncCatalog], true },
        { "SalePos+SaleCod", [PermissionNames.SyncCatalog, PermissionNames.CreateCodOrder], true },
        { "Sale", [PermissionNames.SyncCatalog], true },
        { "Manager", [PermissionNames.SyncCatalog], true },
        { "Admin", PermissionNames.All, true },
        { "SaleCod", [PermissionNames.CreateCodOrder, PermissionNames.VerifyCod], false },
        { "SalePosLegacyCreatePosOnly", [PermissionNames.CreatePosOrder], false },
    };

    [Theory]
    [MemberData(nameof(CatalogSyncActors))]
    public async Task SyncCatalogPolicy_EnforcesExpectedActorAccess(
        string _,
        string[] permissions,
        bool expectedAllowed)
    {
        var identity = new ClaimsIdentity(
            permissions.Select(permission => new Claim("permission", permission)),
            authenticationType: "test");
        var requirement = new PermissionRequirement(PermissionNames.SyncCatalog);
        var context = new AuthorizationHandlerContext(
            [requirement],
            new ClaimsPrincipal(identity),
            resource: null);

        await new PermissionAuthorizationHandler().HandleAsync(context);

        Assert.Equal(expectedAllowed, context.HasSucceeded);
    }

    private static void AssertSyncCatalogPolicy(string methodName)
    {
        var method = typeof(CatalogSyncController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"Missing method {methodName}.");
        var attribute = method.GetCustomAttribute<AuthorizeAttribute>()
            ?? throw new InvalidOperationException($"Missing AuthorizeAttribute on {methodName}.");

        Assert.Equal(PermissionNames.SyncCatalog, attribute.Policy);
        Assert.Null(attribute.Roles);
    }
}
