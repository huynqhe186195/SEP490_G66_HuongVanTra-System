using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace HuongVanTra.Shared.Auth;

public static class AuthorizationServiceExtensions
{
    public static IServiceCollection AddHvtPermissionPolicies(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddSingleton<IAuthorizationHandler, AnyPermissionAuthorizationHandler>();

        services.AddAuthorization(options =>
        {
            foreach (var permission in PermissionNames.All)
            {
                options.AddPolicy(permission, policy =>
                    policy.Requirements.Add(new PermissionRequirement(permission)));
            }

            options.AddPolicy(PermissionNames.CatalogManagement, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageCatalog)));

            options.AddPolicy(PermissionNames.ViewCustomerAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewCustomer,
                    PermissionNames.ViewAllCustomers,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.EditCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageCorporateCustomer)));

            options.AddPolicy(PermissionNames.CreateCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageCorporateCustomer,
                    PermissionNames.CreateOrder)));

            options.AddPolicy(PermissionNames.ApplyDebtPayment, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateOrder,
                    PermissionNames.CreateCustomer)));

            options.AddPolicy(PermissionNames.ShipOrderAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateOrder,
                    PermissionNames.ShipOrder)));
        });

        return services;
    }
}
