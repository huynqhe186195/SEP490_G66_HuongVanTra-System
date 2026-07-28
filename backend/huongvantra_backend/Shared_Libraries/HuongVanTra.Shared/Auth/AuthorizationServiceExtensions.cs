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
                    PermissionNames.ManageRole,
                    PermissionNames.ManageCatalog)));

            options.AddPolicy(PermissionNames.ViewCustomerAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewCustomer,
                    PermissionNames.ViewAllCustomers,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.EditCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.CreateCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.CreateOrder,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.ApplyDebtPayment, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateOrder,
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.ApproveContract, policy =>
                policy.Requirements.Add(new PermissionRequirement(PermissionNames.ApproveContract)));

            options.AddPolicy(PermissionNames.ApprovePrice, policy =>
                policy.Requirements.Add(new PermissionRequirement(PermissionNames.ApprovePrice)));

            options.AddPolicy(PermissionNames.ManageBusinessPolicy, policy =>
                policy.Requirements.Add(new PermissionRequirement(PermissionNames.ManageBusinessPolicy)));
        });

        return services;
    }
}
