namespace HuongVanTra.Core.Authorization {
    /// <summary>
    /// Authorization policy names for ASP.NET Core [Authorize(Policy = ...)].
    /// </summary>
    public static class AppPolicies {
        public const string AdminOnly = "AdminOnly";
        public const string ManageIntegrations = "ManageIntegrations";
        public const string ManageStaff = "ManageStaff";
        public const string ManageContracts = "ManageContracts";
        public const string ViewReports = "ViewReports";
        public const string ManageInventory = "ManageInventory";
        public const string ManageOrders = "ManageOrders";
        public const string ManageCodOps = "ManageCodOps";
        public const string ManageProducts = "ManageProducts";
        public const string ManageCustomers = "ManageCustomers";
        public const string PosAccess = "PosAccess";
        public const string ViewDashboard = "ViewDashboard";
    }
}
