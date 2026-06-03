namespace HuongVanTra.Core.Authorization {
    /// <summary>
    /// Module keys exposed to the client (aligned with frontend navigation).
    /// </summary>
    public static class AppModules {
        public const string Dashboard = "dashboard";
        public const string Pos = "pos";
        public const string Orders = "orders";
        public const string CodOps = "cod_ops";
        public const string Products = "products";
        public const string Inventory = "inventory";
        public const string Customers = "customers";
        public const string Staff = "staff";
        public const string Contracts = "contracts";
        public const string Reports = "reports";
        public const string Integrations = "integrations";
    }

    public static class RolePermissions {
        private static readonly IReadOnlyDictionary<string, string[]> RoleModuleMap =
            new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase) {
                [AppRoles.Admin] = new[] {
                    AppModules.Dashboard,
                    AppModules.Orders,
                    AppModules.Products,
                    AppModules.Inventory,
                    AppModules.Customers,
                    AppModules.Staff,
                    AppModules.Contracts,
                    AppModules.Reports,
                    AppModules.Integrations,
                },
                [AppRoles.AgencyManager] = new[] {
                    AppModules.Dashboard,
                    AppModules.Pos,
                    AppModules.Orders,
                    AppModules.CodOps,
                    AppModules.Products,
                    AppModules.Inventory,
                    AppModules.Customers,
                    AppModules.Staff,
                    AppModules.Contracts,
                    AppModules.Reports,
                },
                [AppRoles.SalesStaff] = new[] {
                    AppModules.Pos,
                    AppModules.Orders,
                },
                [AppRoles.InventoryManager] = new[] {
                    AppModules.Products,
                    AppModules.Inventory,
                },
                [AppRoles.Accountant] = new[] {
                    AppModules.Dashboard,
                    AppModules.Reports,
                },
            };

        public static IReadOnlyList<string> GetModulesForRoles(IEnumerable<string> roles) {
            var modules = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var role in roles) {
                if (RoleModuleMap.TryGetValue(role, out var roleModules)) {
                    foreach (var module in roleModules) {
                        modules.Add(module);
                    }
                }
            }

            return modules.OrderBy(module => module, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public static bool HasModule(IEnumerable<string> roles, string module) {
            return GetModulesForRoles(roles).Contains(module, StringComparer.OrdinalIgnoreCase);
        }
    }
}
