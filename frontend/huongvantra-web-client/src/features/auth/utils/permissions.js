import { isWarehouseUserRole } from '../services/authApi.js'

export function isWarehouseRole(session) {
  return isWarehouseUserRole(session?.roles ?? [])
}

export function isAccountantRole(session) {
  return (session?.roles ?? []).some((role) => {
    const normalized = String(role || '')
      .trim()
      .toLowerCase()
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
    return ['accountant', 'ke toan', 'kế toán'].includes(normalized)
  })
}

function normalizeRoleToken(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, '')
    .replace(/\s+/g, '')
}

function hasAdminRole(session) {
  return (session?.roles ?? []).some((role) => normalizeRoleToken(role) === 'admin')
}

/** Admin chỉ giám sát + IAM — không thao tác nghiệp vụ. */
export function isBusinessOpsBlocked(session) {
  return isSystemAdmin(session) || hasAdminRole(session)
}

/** Kế toán chỉ xem kho — không tạo/duyệt phiếu, không chỉnh tồn. */
export function canWriteInventory(session) {
  if (isAccountantRole(session) || isBusinessOpsBlocked(session)) return false
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session)
}

/** Ngưỡng cảnh báo tồn Kho thuộc quyền Thủ kho. */
export function canEditWarehouseThreshold(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'MANAGE_STOCK_THRESHOLD') && isWarehouseRole(session)) return true
  return isWarehouseRole(session)
}

/** Ngưỡng cảnh báo tồn Kệ Hàng thuộc quyền Quản lý. */
export function canEditShelfThreshold(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'MANAGE_STOCK_THRESHOLD')) {
    return isBranchManager(session) || isManagerRole(session)
  }
  return isBranchManager(session) || isManagerRole(session)
}

export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

/** Báo cáo cuối ngày kho — trang live + gửi (Thủ kho). */
export function canSubmitWarehouseDailyReport(session) {
  return hasPermission(session, 'SUBMIT_WAREHOUSE_REPORT')
}

/** Xem báo cáo live (không gồm lịch sử đã gửi). */
export function canViewWarehouseDailyReportLive(session) {
  return (
    hasPermission(session, 'SUBMIT_WAREHOUSE_REPORT')
    || hasPermission(session, 'OPERATE_WAREHOUSE')
  )
}

export function canViewAllCustomers(session) {
  return hasPermission(session, 'VIEW_ALL_CUSTOMERS') || hasPermission(session, 'MANAGE_ROLE')
}

export function canViewCustomer(session) {
  return hasPermission(session, 'VIEW_CUSTOMER') || canViewAllCustomers(session)
}

/** Tạo hồ sơ KH: Manager và Sale — Admin chỉ xem. */
export function canCreateCustomer(session) {
  if (isBusinessOpsBlocked(session)) return false
  return (
    hasPermission(session, 'CREATE_CUSTOMER')
    || hasPermission(session, 'CREATE_ORDER')
  )
}

/** Sửa hồ sơ KH: Manager (CREATE_CUSTOMER) và Kế toán (MANAGE_CORPORATE_CUSTOMER). Admin chỉ xem. */
export function canEditCustomer(session) {
  if (isBusinessOpsBlocked(session)) return false
  return (
    hasPermission(session, 'CREATE_CUSTOMER')
    || hasPermission(session, 'MANAGE_CORPORATE_CUSTOMER')
  )
}

/** Sale (hoặc NV chỉ có VIEW_CUSTOMER): xem toàn bộ khách trong cửa hàng, thêm được nhưng không sửa hồ sơ. */
export function isReadOnlyCustomerViewer(session) {
  return canViewCustomer(session) && !canViewAllCustomers(session)
}

/** Xóa/khôi phục KH — Manager vận hành; Admin chỉ xem. */
export function canDeleteCustomer(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
}

/** Manager/Admin/Kế toán có thêm bộ lọc theo nhân viên; Sale xem mọi đơn nhưng không lọc theo nhân viên. */
export function canViewAllOrders(session) {
  return (
    hasPermission(session, 'VIEW_ALL_CUSTOMERS')
    || hasPermission(session, 'MANAGE_EMPLOYEE')
    || hasPermission(session, 'MANAGE_ROLE')
  )
}

export function canSimulateOrderCompleted(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CREATE_ORDER')
}

export function canManageCatalog(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'MANAGE_CATALOG')) return true
  return isWarehouseRole(session)
}

/** Nhãn (Brand): Quản lý qua MANAGE_TAXONOMY, Thủ kho qua MANAGE_CATALOG — khớp policy MANAGE_TAXONOMY_ACCESS. */
export function canManageTaxonomy(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'MANAGE_TAXONOMY') || canManageCatalog(session)
}

/** Chỉ Thủ kho được tạo mới sản phẩm / danh mục / SKU. */
export function canCreateCatalog(session) {
  return isWarehouseRole(session) && !isBusinessOpsBlocked(session)
}

/** Chỉ Thủ kho được ẩn / kích hoạt lại sản phẩm, danh mục. */
export function canHideCatalog(session) {
  return canCreateCatalog(session)
}

export function canCreateProductDeletionRequest(session) {
  return isWarehouseRole(session) && !isBusinessOpsBlocked(session)
}

export function canAccessWarehouseInventory(session) {
  return isWarehouseRole(session)
}

/** Chỉ Thủ kho được sửa sản phẩm, danh mục, SKU. */
export function canManageProducts(session) {
  return canCreateCatalog(session)
}

export function canSyncCatalog(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'SYNC_CATALOG')) return true
  return !canCreateCatalog(session) && (canManageCatalog(session) || canAdjustStoreStock(session))
}

export function canViewOrders(session) {
  return hasPermission(session, 'VIEW_ORDER')
}

export function canCreateOrder(session) {
  return canUsePosCounterMode(session) || canUsePosCodMode(session)
}

/** Lập đơn bán theo hợp đồng — Kế toán, Quản lý. Sale quầy/COD không có quyền này. */
export function canCreateB2BOrder(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CREATE_B2B_ORDER')
}

/** Xác nhận đã xuất hàng khỏi kho — Thủ kho, Quản lý. */
export function canConfirmOrderShipping(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'SHIP_ORDER')
}

/** Xác nhận khách đã nhận hàng và ghi công nợ hợp đồng — Kế toán, Quản lý. */
export function canConfirmB2BDelivery(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CONFIRM_B2B_DELIVERY')
}

/** Xác nhận thanh toán COD — chỉ dựa trên action permission. */
export function canVerifyCodPayment(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'VERIFY_COD')
}

/**
 * Admin là vai trò chỉ xem/audit và có độ ưu tiên cao nhất: người dùng kiêm nhiệm
 * Admin + Sale/Manager/Warehouse vẫn phải nhận giao diện read-only, không có thao tác nghiệp vụ.
 */
export function isAuditOnlyAdmin(session) {
  return hasAdminRole(session)
}

/** Trang Accounting: chỉ Kế toán được sửa Giá bán; Admin/Manager chỉ xem. */
export function canEditAccountingSalePrice(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isAccountantRole(session)
}

export function isSalePosRole(session) {
  return (session?.roles ?? []).some((role) => {
    const key = normalizeRoleToken(role)
    return key === 'salepos' || key === 'sale'
  })
}

export function isSaleCodRole(session) {
  return (session?.roles ?? []).some((role) => normalizeRoleToken(role) === 'salecod')
}

/** Tương thích tên helper cũ; quyết định COD-only dựa trên permission union. */
export function isSaleCodOnlyRole(session) {
  return canViewOnlyCodOrders(session)
}

export function canViewOnlyCodOrders(session) {
  if (canViewAllOrders(session)) return false
  return canUsePosCodMode(session) && !canUsePosCounterMode(session)
}

/** Quầy POS: SalePos (CREATE_POS_ORDER) hoặc Manager. */
export function canUsePosCounterMode(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CREATE_POS_ORDER')
    || isBranchManager(session)
    || isManagerRole(session)
}

/** Bán COD: action permission độc lập với VERIFY_COD. */
export function canUsePosCodMode(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CREATE_COD_ORDER')
}

export function canAdjustStoreStock(session) {
  return canCreateStockReplenishmentRequest(session)
}

/** Yêu cầu bổ sung Kệ Hàng: Manager tạo; Thủ kho và Admin xem/duyệt. Sale không dùng. */
export function canCreateStockReplenishmentRequest(session) {
  if (hasAdminRole(session)) return false
  if (isWarehouseRole(session)) return false
  if (hasPermission(session, 'CREATE_SHELF_REPLENISHMENT')) return true
  return (
    isBranchManager(session)
    || isManagerRole(session)
    || isSystemAdmin(session)
  )
}

/** Xem Yêu cầu bổ sung Kệ Hàng: Manager, Thủ kho, Admin. */
export function canViewStockReplenishmentRequest(session) {
  return (
    isBranchManager(session)
    || isManagerRole(session)
    || isWarehouseRole(session)
    || hasAdminRole(session)
    || isSystemAdmin(session)
  )
}

/**
 * Bộ lọc theo người tạo / chức vụ người tạo của màn hình Yêu cầu bổ sung Kệ Hàng.
 * Sale thuần chỉ thấy yêu cầu của chính mình nên không có dữ liệu để lọc; backend
 * cũng chặn endpoint filter-options với Sale.
 */
export function canFilterStockReplenishmentByCreator(session) {
  return (
    isBranchManager(session)
    || isManagerRole(session)
    || isWarehouseRole(session)
    || isAccountantRole(session)
    || hasAdminRole(session)
    || isSystemAdmin(session)
  )
}

/** Xử lý trọn từng sản phẩm trong yêu cầu: chỉ Warehouse không có role Admin. */
export function canReviewStockReplenishmentRequest(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

/**
 * Kiểm tra & quyết định xử lý hàng trả (Bán lại / Tiêu hủy) — chỉ Thủ kho.
 * Quản lý / Admin không thao tác nghiệp vụ này.
 */
export function canInspectReturn(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'PERFORM_RETURN_INSPECTION')) return true
  if (hasPermission(session, 'OPERATE_WAREHOUSE')) return true
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session)
}

/** Xem danh sách kiểm tra hàng trả — cùng phạm vi Thủ kho. */
export function canViewReturnInspections(session) {
  return canInspectReturn(session)
}

/** Huỷ yêu cầu đang chờ xử lý: chỉ Manager tạo yêu cầu; Warehouse và Admin không được huỷ. */
export function canCancelStockReplenishmentRequest(session) {
  if (hasAdminRole(session)) return false
  if (isWarehouseRole(session)) return false
  return (
    isBranchManager(session)
    || isManagerRole(session)
    || isSystemAdmin(session)
  )
}

/** Kho → Kệ: Warehouse vận hành; principal có role Admin luôn chỉ được xem. */
export function canOperateStockTransfer(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

/** Warehouse, Manager và Admin được xem lịch sử/chi tiết Phiếu điều chuyển. */
export function canViewStockTransfer(session) {
  return (
    isWarehouseRole(session)
    || isBranchManager(session)
    || isManagerRole(session)
    || hasAdminRole(session)
    || isSystemAdmin(session)
  )
}

/** Duyệt / Từ chối phiếu nhập NCC: chỉ Manager không có role Admin. */
export function canReviewSupplierReceipt(session) {
  return (isBranchManager(session) || isManagerRole(session)) && !hasAdminRole(session)
}

/** Warehouse là actor vận hành duy nhất của Supplier Receipt trong Batch 1A. */
export function canOperateSupplierReceipt(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

/** Trả hàng nhập (Kho → NCC): chỉ Thủ kho được tạo, Admin/Manager chỉ xem. */
export function canOperateSupplierReturn(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canCreateProductionOrder(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canSubmitProductionOrder(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canCompleteProductionOrder(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canCancelProductionOrder(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canReviewProductionOrder(session) {
  return (isBranchManager(session) || isManagerRole(session)) && !hasAdminRole(session)
}

export function canCreateWarehouseStocktake(session) {
  return isWarehouseRole(session) && !hasAdminRole(session)
}

export function canCreateShelfStocktake(session) {
  return (
    canCreateOrder(session)
    && !isWarehouseRole(session)
    && !isBranchManager(session)
    && !isManagerRole(session)
    && !hasAdminRole(session)
  )
}

export function canReviewStocktake(session) {
  return (isBranchManager(session) || isManagerRole(session)) && !hasAdminRole(session)
}

export function isSystemAdmin(session) {
  return hasPermission(session, 'MANAGE_ROLE')
}

/** Khách doanh nghiệp: Quản lý và Kế toán; Admin giám sát không thao tác nghiệp vụ. */
export function canManageCorporateCustomers(session) {
  if (isBusinessOpsBlocked(session)) return false
  return (
    hasPermission(session, 'MANAGE_CORPORATE_CUSTOMER')
    || isBranchManager(session)
    || isManagerRole(session)
    || isAccountantRole(session)
  )
}

export function isBranchManager(session) {
  return hasPermission(session, 'MANAGE_EMPLOYEE') && !isSystemAdmin(session)
}

function isManagerRole(session) {
  if (isSystemAdmin(session) || isWarehouseRole(session)) return false
  return (session?.roles ?? []).some((role) => {
    const compact = normalizeRoleToken(role)
    return [
      'manager',
      'agencymanager',
      'branchmanager',
      'owner',
      'chucoso',
      'chủcơsở',
    ].includes(compact)
  })
}

export function canViewContracts(session) {
  return hasPermission(session, 'VIEW_CUSTOMER') || hasPermission(session, 'MANAGE_ROLE')
}

/** Lập hợp đồng: Kế toán và Quản lý — Admin chỉ giám sát. */
export function canCreateContracts(session) {
  if (isBusinessOpsBlocked(session)) return false
  if (hasPermission(session, 'MANAGE_CORPORATE_CUSTOMER') || hasPermission(session, 'CREATE_B2B_ORDER')) {
    return true
  }
  return isAccountantRole(session) || isBranchManager(session) || isManagerRole(session)
}

/** Phán quyết hợp đồng: chỉ Quản lý (APPROVE_CONTRACT). */
export function canApproveContracts(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'APPROVE_CONTRACT')
}

/** Hoàn backorder: Manager duyệt; Manager hoặc Kế toán ghi nhận chứng từ hoàn tiền. */
export function canReviewBackorderRefund(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
}

export function canCompleteBackorderRefund(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isAccountantRole(session) || isBranchManager(session) || isManagerRole(session)
}

/** Manager / Thủ kho tạo-sửa NCC; Admin không thao tác nghiệp vụ. */
export function canManageSuppliers(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'MANAGE_SUPPLIERS')
}

/** Chỉ Manager ẩn/khôi phục nhà cung cấp (DELETE_SUPPLIER). */
export function canDeleteSupplier(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'DELETE_SUPPLIER')
}

/** Manager / Thủ kho duy trì mapping mặt hàng NCC. */
export function canManageSupplierProducts(session) {
  if (isBusinessOpsBlocked(session)) return false
  return (
    hasPermission(session, 'MANAGE_SUPPLIER_PRODUCT')
    || hasPermission(session, 'MANAGE_SUPPLIERS')
  )
}

/** Manager duyệt yêu cầu tạo/xóa hàng hóa; Admin chỉ theo dõi. */
export function canDecideProductApprovals(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
}

export function getStaffManagementScopeLabel(session) {
  if (isSystemAdmin(session)) return 'Quản lý nhân sự: Manager'
  if (isBranchManager(session)) return 'Quản lý nhân sự: Sale quầy/COD, Kế toán, Thủ kho'
  return 'Quản lý nhân sự'
}
