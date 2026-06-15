namespace HuongVanTra.Shared.Auth;

public static class PermissionNames
{
    public const string CreateOrder = "CREATE_ORDER";
    public const string ViewOrder = "VIEW_ORDER";
    public const string CreateCustomer = "CREATE_CUSTOMER";
    public const string ViewCustomer = "VIEW_CUSTOMER";
    public const string ViewAllCustomers = "VIEW_ALL_CUSTOMERS";
    public const string ManageEmployee = "MANAGE_EMPLOYEE";
    public const string ManageUser = "MANAGE_USER";
    public const string ManageRole = "MANAGE_ROLE";
    public const string ManageCatalog = "MANAGE_CATALOG";

    /// <summary>Sửa hồ sơ KH — Admin/Manager/Kế toán (VIEW_ALL_CUSTOMERS).</summary>
    public const string EditCustomerProfile = "EDIT_CUSTOMER_PROFILE";

    /// <summary>Admin hoặc Thủ kho — tạo/sửa sản phẩm, danh mục, SKU.</summary>
    public const string CatalogManagement = "CATALOG_MANAGEMENT";

    public static readonly string[] All =
    [
        CreateOrder,
        ViewOrder,
        CreateCustomer,
        ViewCustomer,
        ViewAllCustomers,
        ManageEmployee,
        ManageUser,
        ManageRole,
        ManageCatalog
    ];
}
