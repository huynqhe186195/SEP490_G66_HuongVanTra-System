namespace HuongVanTra.Core.Authorization {
    /// <summary>
    /// Role names stored in the database (see IdentityDataSeeder).
    /// </summary>
    public static class AppRoles {
        public const string Admin = "Admin";
        public const string AgencyManager = "Agency Manager";
        public const string SalesStaff = "Sales Staff";
        public const string InventoryManager = "Inventory Manager";
        public const string Accountant = "Accountant";

        public static readonly string[] All = {
            Admin,
            AgencyManager,
            SalesStaff,
            InventoryManager,
            Accountant,
        };
    }
}
