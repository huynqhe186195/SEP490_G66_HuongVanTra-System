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

    /// <summary>
    /// Sửa danh mục tra cứu (nhãn/thương hiệu) — Manager, Thủ kho. Tách khỏi MANAGE_CATALOG
    /// để Manager không đồng thời được CRUD sản phẩm/bảng giá và bỏ qua luồng duyệt yêu cầu.
    /// </summary>
    public const string ManageTaxonomy = "MANAGE_TAXONOMY";

    public const string ViewCatalog = "VIEW_CATALOG";
    public const string SyncCatalog = "SYNC_CATALOG";
    public const string ApprovePrice = "APPROVE_PRICE";

    /// <summary>Phán quyết hợp đồng khách doanh nghiệp (duyệt/từ chối) — Manager / Admin.</summary>
    public const string ApproveContract = "APPROVE_CONTRACT";

    public const string ManageBusinessPolicy = "MANAGE_BUSINESS_POLICY";
    public const string VerifyCod = "VERIFY_COD";
    public const string MonitorOutbox = "MONITOR_OUTBOX";
    public const string ViewInventory = "VIEW_INVENTORY";
    public const string OperateWarehouse = "OPERATE_WAREHOUSE";
    public const string ApproveInventory = "APPROVE_INVENTORY";
    public const string RejectStockDeduct = "REJECT_STOCK_DEDUCT";
    public const string ManageSuppliers = "MANAGE_SUPPLIERS";
    /// <summary>Ẩn/khôi phục nhà cung cấp — Manager (+ Admin nếu được gán), không gồm Thủ kho.</summary>
    public const string DeleteSupplier = "DELETE_SUPPLIER";
    public const string ManageSupplierProduct = "MANAGE_SUPPLIER_PRODUCT";
    public const string ManageCost = "MANAGE_COST";
    public const string ViewCost = "VIEW_COST";
    public const string SubmitWarehouseReport = "SUBMIT_WAREHOUSE_REPORT";
    public const string BroadcastNotification = "BROADCAST_NOTIFICATION";
    public const string ViewProductRequest = "VIEW_PRODUCT_REQUEST";
    public const string ApproveProductRequest = "APPROVE_PRODUCT_REQUEST";
    public const string CreateShelfReplenishment = "CREATE_SHELF_REPLENISHMENT";
    public const string ApproveShelfReplenishment = "APPROVE_SHELF_REPLENISHMENT";
    public const string PerformReturnInspection = "PERFORM_RETURN_INSPECTION";
    public const string ManageStockThreshold = "MANAGE_STOCK_THRESHOLD";

    /// <summary>Tạo/sửa hồ sơ khách doanh nghiệp — Kế toán, Manager, Admin.</summary>
    public const string ManageCorporateCustomer = "MANAGE_CORPORATE_CUSTOMER";

    /// <summary>Lập đơn bán theo hợp đồng — Kế toán, Manager. Sale quầy/COD không có.</summary>
    public const string CreateB2BOrder = "CREATE_B2B_ORDER";

    /// <summary>Xác nhận xuất hàng khỏi kho cho đơn hợp đồng — Thủ kho, Manager.</summary>
    public const string ShipOrder = "SHIP_ORDER";

    /// <summary>Xác nhận khách đã nhận hàng + ghi công nợ đơn hợp đồng — Kế toán, Manager.</summary>
    public const string ConfirmB2BDelivery = "CONFIRM_B2B_DELIVERY";

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
        ManageTaxonomy,
        ViewCatalog,
        SyncCatalog,
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
        DeleteSupplier,
        ManageSupplierProduct,
        ManageCost,
        ViewCost,
        SubmitWarehouseReport,
        BroadcastNotification,
        ViewProductRequest,
        ApproveProductRequest,
        CreateShelfReplenishment,
        ApproveShelfReplenishment,
        PerformReturnInspection,
        ManageStockThreshold,
        ManageCorporateCustomer,
        CreateB2BOrder,
        ShipOrder,
        ConfirmB2BDelivery,
    ];
}
