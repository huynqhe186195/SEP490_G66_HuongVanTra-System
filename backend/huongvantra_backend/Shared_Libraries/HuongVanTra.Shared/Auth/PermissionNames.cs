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
    public const string VerifyCod = "VERIFY_COD";
    public const string MonitorOutbox = "MONITOR_OUTBOX";

    // ── Inventory / Product ops ──────────────────────────────────────────
    public const string ViewInventory = "VIEW_INVENTORY";
    public const string OperateWarehouse = "OPERATE_WAREHOUSE";
    public const string ApproveInventory = "APPROVE_INVENTORY";
    public const string RejectStockDeduct = "REJECT_STOCK_DEDUCT";
    public const string ManageSuppliers = "MANAGE_SUPPLIERS";
    public const string ManageCost = "MANAGE_COST";
    public const string ViewCost = "VIEW_COST";
    public const string SubmitWarehouseReport = "SUBMIT_WAREHOUSE_REPORT";
    public const string BroadcastNotification = "BROADCAST_NOTIFICATION";
    public const string ViewProductRequest = "VIEW_PRODUCT_REQUEST";
    public const string ApproveProductRequest = "APPROVE_PRODUCT_REQUEST";

    // ── Composite policy names (không seed DB) ───────────────────────────
    public const string ViewCustomerAccess = "VIEW_CUSTOMER_ACCESS";
    public const string EditCustomerProfile = "EDIT_CUSTOMER_PROFILE";
    public const string CreateCustomerProfile = "CREATE_CUSTOMER_PROFILE";
    public const string CatalogManagement = "CATALOG_MANAGEMENT";
    public const string ApplyDebtPayment = "APPLY_DEBT_PAYMENT";
    public const string StockAdjustmentReadAccess = "STOCK_ADJUSTMENT_READ_ACCESS";
    public const string StockAdjustmentCreateAccess = "STOCK_ADJUSTMENT_CREATE_ACCESS";
    public const string ViewCatalogAccess = "VIEW_CATALOG_ACCESS";
    public const string WarehouseOrManagerOps = "WAREHOUSE_OR_MANAGER_OPS";
    public const string MaterialsDeductAccess = "MATERIALS_DEDUCT_ACCESS";
    public const string CancelRetailPriceAccess = "CANCEL_RETAIL_PRICE_ACCESS";

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
        VerifyCod,
        MonitorOutbox,
        ViewInventory,
        OperateWarehouse,
        ApproveInventory,
        RejectStockDeduct,
        ManageSuppliers,
        ManageCost,
        ViewCost,
        SubmitWarehouseReport,
        BroadcastNotification,
        ViewProductRequest,
        ApproveProductRequest,
    ];
}
