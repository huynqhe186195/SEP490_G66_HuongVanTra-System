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

    /// <summary>
    /// Sửa danh mục tra cứu (nhãn/thương hiệu) — Manager, Thủ kho. Tách khỏi MANAGE_CATALOG
    /// để Manager không đồng thời được CRUD sản phẩm/bảng giá và bỏ qua luồng duyệt yêu cầu.
    /// </summary>
    public const string ManageTaxonomy = "MANAGE_TAXONOMY";

    public const string ViewCatalog = "VIEW_CATALOG";
    public const string SyncCatalog = "SYNC_CATALOG";
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

    // ── Composite policy names (không seed DB) ───────────────────────────
    public const string ViewCustomerAccess = "VIEW_CUSTOMER_ACCESS";
    public const string EditCustomerProfile = "EDIT_CUSTOMER_PROFILE";
    public const string CreateCustomerProfile = "CREATE_CUSTOMER_PROFILE";
    public const string CatalogManagement = "CATALOG_MANAGEMENT";
    public const string ApplyDebtPayment = "APPLY_DEBT_PAYMENT";
    public const string StockAdjustmentReadAccess = "STOCK_ADJUSTMENT_READ_ACCESS";
    public const string StockAdjustmentCreateAccess = "STOCK_ADJUSTMENT_CREATE_ACCESS";

    /// <summary>Tạo phiếu kiểm kê: Sale (kệ hàng) hoặc Thủ kho (kho tổng). Vị trí được siết thêm ở controller.</summary>
    public const string StocktakeCreateAccess = "STOCKTAKE_CREATE_ACCESS";

    public const string ViewCatalogAccess = "VIEW_CATALOG_ACCESS";

    /// <summary>Tìm SKU để lập hợp đồng B2B — luôn thấy cả nguyên liệu/bao bì (scope Kho), không phụ thuộc role Thủ kho.</summary>
    public const string ContractCatalogAccess = "CONTRACT_CATALOG_ACCESS";
    public const string WarehouseOrManagerOps = "WAREHOUSE_OR_MANAGER_OPS";
    public const string MaterialsDeductAccess = "MATERIALS_DEDUCT_ACCESS";
    public const string CancelRetailPriceAccess = "CANCEL_RETAIL_PRICE_ACCESS";

    /// <summary>
    /// Duyệt/xử lý yêu cầu bổ sung kệ — Thủ kho (legacy OPERATE_WAREHOUSE hoặc APPROVE_SHELF_REPLENISHMENT).
    /// INV-01..05 sẽ siết dần về quyền mới.
    /// </summary>
    public const string ShelfReplenishmentApproveAccess = "SHELF_REPLENISHMENT_APPROVE_ACCESS";

    /// <summary>Ghi mặt hàng NCC — MANAGE_SUPPLIER_PRODUCT hoặc legacy MANAGE_SUPPLIERS.</summary>
    public const string ManageSupplierProductAccess = "MANAGE_SUPPLIER_PRODUCT_ACCESS";

    /// <summary>Kiểm tra hàng trả — PERFORM_RETURN_INSPECTION hoặc legacy OPERATE_WAREHOUSE.</summary>
    public const string ReturnInspectionAccess = "RETURN_INSPECTION_ACCESS";

    /// <summary>Sửa ngưỡng tồn kệ — MANAGE_STOCK_THRESHOLD hoặc legacy APPROVE_INVENTORY.</summary>
    public const string ManageShelfStockThresholdAccess = "MANAGE_SHELF_STOCK_THRESHOLD_ACCESS";

    /// <summary>Sửa ngưỡng tồn kho — MANAGE_STOCK_THRESHOLD hoặc legacy OPERATE_WAREHOUSE.</summary>
    public const string ManageWarehouseStockThresholdAccess = "MANAGE_WAREHOUSE_STOCK_THRESHOLD_ACCESS";

    /// <summary>Tạo/sửa hồ sơ khách doanh nghiệp — Kế toán, Manager, Admin.</summary>
    public const string ManageCorporateCustomer = "MANAGE_CORPORATE_CUSTOMER";

    /// <summary>Lập đơn bán theo hợp đồng — Kế toán, Manager. Sale quầy/COD không có.</summary>
    public const string CreateB2BOrder = "CREATE_B2B_ORDER";

    /// <summary>Xác nhận xuất hàng khỏi kho cho đơn hợp đồng — Thủ kho, Manager.</summary>
    public const string ShipOrder = "SHIP_ORDER";

    /// <summary>Xác nhận khách đã nhận hàng + ghi công nợ đơn hợp đồng — Kế toán, Manager.</summary>
    public const string ConfirmB2BDelivery = "CONFIRM_B2B_DELIVERY";

    /// <summary>
    /// Endpoint chuyển đơn sang "đang giao": Sale/Manager (CREATE_ORDER) cho đơn COD,
    /// hoặc Thủ kho (SHIP_ORDER) cho đơn hợp đồng. Phân biệt theo đơn ở tầng Application.
    /// </summary>
    public const string ShipOrderAccess = "SHIP_ORDER_ACCESS";

    /// <summary>Đọc danh mục hạng thành viên (tham chiếu cho KH / POS / khuyến mãi).</summary>
    public const string ViewMembershipTierAccess = "VIEW_MEMBERSHIP_TIER_ACCESS";

    /// <summary>Tạo/sửa/ngưng hạng thành viên — Admin (MANAGE_BUSINESS_POLICY) hoặc Manager (CREATE_CUSTOMER).</summary>
    public const string ManageMembershipTierAccess = "MANAGE_MEMBERSHIP_TIER_ACCESS";

    /// <summary>Sửa danh mục nhãn — MANAGE_TAXONOMY (Manager) hoặc legacy MANAGE_CATALOG (Thủ kho).</summary>
    public const string ManageTaxonomyAccess = "MANAGE_TAXONOMY_ACCESS";

    /// <summary>Sửa giá bán trên trang kế toán — Manager (MANAGE_CATALOG) hoặc Kế toán (MANAGE_COST).</summary>
    public const string UpdateAccountingRetailPriceAccess = "UPDATE_ACCOUNTING_RETAIL_PRICE_ACCESS";

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
