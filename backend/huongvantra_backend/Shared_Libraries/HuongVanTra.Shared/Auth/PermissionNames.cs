namespace HuongVanTra.Shared.Auth;

public static class PermissionNames
{
    public const string CreateOrder = "CREATE_ORDER";
    public const string CreatePosOrder = "CREATE_POS_ORDER";
    public const string CreateCodOrder = "CREATE_COD_ORDER";
    public const string ViewOrder = "VIEW_ORDER";
    public const string CreateCustomer = "CREATE_CUSTOMER";
    public const string ViewCustomer = "VIEW_CUSTOMER";
    public const string ViewAllCustomers = "VIEW_ALL_CUSTOMERS";
    public const string ManageEmployee = "MANAGE_EMPLOYEE";
    public const string ManageUser = "MANAGE_USER";
    public const string ManageRole = "MANAGE_ROLE";
    public const string ManageCatalog = "MANAGE_CATALOG";
    public const string ApprovePrice = "APPROVE_PRICE";
    public const string ApproveContract = "APPROVE_CONTRACT";
    public const string ManageBusinessPolicy = "MANAGE_BUSINESS_POLICY";

    /// <summary>Tạo/theo dõi/xác nhận thu COD — SaleCod, Manager, Admin.</summary>
    public const string VerifyCod = "VERIFY_COD";

    /// <summary>Xem danh sách/chi tiết KH — Sale (VIEW_CUSTOMER) hoặc Manager/Kế toán (VIEW_ALL_CUSTOMERS).</summary>
    public const string ViewCustomerAccess = "VIEW_CUSTOMER_ACCESS";

    /// <summary>Sửa hồ sơ KH — Admin (MANAGE_ROLE) hoặc Manager (CREATE_CUSTOMER). Kế toán chỉ xem.</summary>
    public const string EditCustomerProfile = "EDIT_CUSTOMER_PROFILE";

    /// <summary>
    /// Tạo hồ sơ KH mới — Sale (CREATE_ORDER) vẫn được tạo khách trong phạm vi cửa hàng,
    /// ngoài Manager (CREATE_CUSTOMER) và Admin (MANAGE_ROLE). Import/công nợ vẫn giữ ở CREATE_CUSTOMER.
    /// </summary>
    public const string CreateCustomerProfile = "CREATE_CUSTOMER_PROFILE";

    /// <summary>Admin hoặc Thủ kho — tạo/sửa sản phẩm, danh mục, SKU.</summary>
    public const string CatalogManagement = "CATALOG_MANAGEMENT";

    /// <summary>POS cashier (CREATE_ORDER) hoặc admin (CREATE_CUSTOMER) đều được trừ công nợ khi checkout.</summary>
    public const string ApplyDebtPayment = "APPLY_DEBT_PAYMENT";

    public static readonly string[] All =
    [
        CreateOrder,
        CreatePosOrder,
        CreateCodOrder,
        ViewOrder,
        CreateCustomer,
        ViewCustomer,
        ViewAllCustomers,
        ManageEmployee,
        ManageUser,
        ManageRole,
        ManageCatalog,
        ApprovePrice,
        ApproveContract,
        ManageBusinessPolicy,
        VerifyCod
    ];
}
