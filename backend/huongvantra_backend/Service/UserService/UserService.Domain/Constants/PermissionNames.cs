namespace UserService.Domain.Constants;

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
    public const string VerifyCod = "VERIFY_COD";

    /// <summary>Tạo/sửa hồ sơ khách doanh nghiệp — Kế toán, Manager, Admin.</summary>
    public const string ManageCorporateCustomer = "MANAGE_CORPORATE_CUSTOMER";

    /// <summary>Lập đơn bán theo hợp đồng — Kế toán, Manager. Sale quầy/COD không có.</summary>
    public const string CreateB2BOrder = "CREATE_B2B_ORDER";

    /// <summary>Xác nhận xuất hàng khỏi kho cho đơn hợp đồng — Thủ kho, Manager.</summary>
    public const string ShipOrder = "SHIP_ORDER";

    /// <summary>Xác nhận khách đã nhận hàng + ghi công nợ đơn hợp đồng — Kế toán, Manager.</summary>
    public const string ConfirmB2BDelivery = "CONFIRM_B2B_DELIVERY";

    /// <summary>Phán quyết hợp đồng khách doanh nghiệp (duyệt/từ chối) — chỉ Manager.</summary>
    public const string ApproveContract = "APPROVE_CONTRACT";

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
        VerifyCod,
        ManageCorporateCustomer,
        CreateB2BOrder,
        ShipOrder,
        ConfirmB2BDelivery,
        ApproveContract
    ];
}
