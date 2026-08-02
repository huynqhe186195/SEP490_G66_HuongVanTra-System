using System.Security.Claims;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace CustomerService.Application.Tests;

/// <summary>
/// PM không tước quyền tạo khách hàng mới của Sale: Sale (CREATE_ORDER) phải tạo được hồ sơ
/// khách hàng qua <c>POST /api/customers</c>, trong khi quyền sửa hồ sơ vẫn giới hạn ở
/// Manager (CREATE_CUSTOMER).
/// Admin (MANAGE_ROLE) là vai trò audit-only: không được ghi dữ liệu nghiệp vụ khách hàng.
/// </summary>
public sealed class CustomerCreatePermissionPolicyTests
{
    private static readonly IAuthorizationService Authorization = BuildAuthorizationService();

    private static IAuthorizationService BuildAuthorizationService()
    {
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.SetMinimumLevel(LogLevel.None));
        services.AddHvtPermissionPolicies();
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static ClaimsPrincipal UserWith(params string[] permissions) =>
        new(new ClaimsIdentity(
            permissions.Select(p => new Claim("permission", p)),
            authenticationType: "Test"));

    private static Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, string policy) =>
        Authorization.AuthorizeAsync(user, resource: null, policy);

    [Theory]
    [InlineData(PermissionNames.CreateOrder)]
    [InlineData(PermissionNames.CreateCustomer)]
    public async Task Create_customer_profile_allows_sale_and_manager(string permission)
    {
        var result = await AuthorizeAsync(
            UserWith(PermissionNames.ViewCustomer, permission),
            PermissionNames.CreateCustomerProfile);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task Create_customer_profile_denies_audit_only_admin()
    {
        var result = await AuthorizeAsync(
            UserWith(PermissionNames.ViewCustomer, PermissionNames.ManageRole),
            PermissionNames.CreateCustomerProfile);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Create_customer_profile_denies_a_view_only_user()
    {
        var result = await AuthorizeAsync(
            UserWith(PermissionNames.ViewCustomer, PermissionNames.ViewAllCustomers),
            PermissionNames.CreateCustomerProfile);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Edit_customer_profile_still_excludes_sale()
    {
        var sale = UserWith(PermissionNames.ViewCustomer, PermissionNames.CreateOrder);

        var edit = await AuthorizeAsync(sale, PermissionNames.EditCustomerProfile);
        var manager = await AuthorizeAsync(
            UserWith(PermissionNames.CreateCustomer), PermissionNames.EditCustomerProfile);

        Assert.False(edit.Succeeded);
        Assert.True(manager.Succeeded);
    }

    [Fact]
    public async Task Delete_and_restore_remain_admin_only()
    {
        var sale = await AuthorizeAsync(
            UserWith(PermissionNames.ViewCustomer, PermissionNames.CreateOrder),
            PermissionNames.ManageRole);
        var manager = await AuthorizeAsync(
            UserWith(PermissionNames.CreateCustomer), PermissionNames.ManageRole);
        var admin = await AuthorizeAsync(
            UserWith(PermissionNames.ManageRole), PermissionNames.ManageRole);

        Assert.False(sale.Succeeded);
        Assert.False(manager.Succeeded);
        Assert.True(admin.Succeeded);
    }

    [Fact]
    public async Task Sale_keeps_store_wide_customer_read_access()
    {
        var result = await AuthorizeAsync(
            UserWith(PermissionNames.ViewCustomer, PermissionNames.CreateOrder),
            PermissionNames.ViewCustomerAccess);

        Assert.True(result.Succeeded);
    }
}
