using HuongVanTra.Core.Authorization;
using Microsoft.AspNetCore.Authorization;

namespace HuongVanTra.API.Authorization {
    public static class AuthorizationServiceExtensions {
        public static IServiceCollection AddAppAuthorization(this IServiceCollection services) {
            services.AddAuthorization(options => {
                options.AddPolicy(AppPolicies.AdminOnly, policy =>
                    policy.RequireRole(AppRoles.Admin));

                options.AddPolicy(AppPolicies.ManageIntegrations, policy =>
                    policy.RequireRole(AppRoles.Admin));

                options.AddPolicy(AppPolicies.ManageStaff, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager));

                options.AddPolicy(AppPolicies.ManageContracts, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager));

                options.AddPolicy(AppPolicies.ViewReports, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager, AppRoles.Accountant));

                options.AddPolicy(AppPolicies.ManageInventory, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager, AppRoles.InventoryManager));

                options.AddPolicy(AppPolicies.ManageOrders, policy =>
                    policy.RequireRole(
                        AppRoles.Admin,
                        AppRoles.AgencyManager,
                        AppRoles.SalesStaff,
                        AppRoles.InventoryManager));

                options.AddPolicy(AppPolicies.ManageProducts, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager, AppRoles.InventoryManager));

                options.AddPolicy(AppPolicies.ManageCustomers, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager));

                options.AddPolicy(AppPolicies.PosAccess, policy =>
                    policy.RequireRole(AppRoles.Admin, AppRoles.AgencyManager, AppRoles.SalesStaff));

                options.AddPolicy(AppPolicies.ViewDashboard, policy =>
                    policy.RequireRole(
                        AppRoles.Admin,
                        AppRoles.AgencyManager,
                        AppRoles.Accountant));
            });

            return services;
        }
    }
}
