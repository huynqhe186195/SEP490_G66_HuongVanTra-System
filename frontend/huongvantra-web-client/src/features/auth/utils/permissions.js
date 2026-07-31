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

export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
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

/** Sửa hồ sơ KH: Manager (CREATE_CUSTOMER). Kế toán/Admin chỉ xem. */
export function canEditCustomer(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'CREATE_CUSTOMER')
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
  return !canCreateCatalog(session) && (canManageCatalog(session) || canAdjustStoreStock(session))
}

export function canViewOrders(session) {
  return hasPermission(session, 'VIEW_ORDER')
}

export function canCreateOrder(session) {
  return canUsePosCounterMode(session) || canUsePosCodMode(session)
}

/** Xác nhận thanh toán COD — chỉ dựa trên action permission. */
export function canVerifyCodPayment(session) {
  if (isBusinessOpsBlocked(session)) return false
  return hasPermission(session, 'VERIFY_COD')
}

/** Trang Accounting: Manager được sửa Giá bán; Admin chỉ xem. */
export function canEditAccountingSalePrice(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
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

export function canCreateStockReplenishmentRequest(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session)
}

export function canReviewStockReplenishmentRequest(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session)
}

/** Kiểm tra & quyết định xử lý hàng trả (Restock/Quarantine/Dispose): Thủ kho, Quản lý. */
export function canInspectReturn(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session)
}

export function canCancelStockReplenishmentRequest(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session)
}

/** Duyệt / Từ chối phiếu nhập NCC: chỉ Manager không có role Admin. */
export function canReviewSupplierReceipt(session) {
  return (isBranchManager(session) || isManagerRole(session)) && !hasAdminRole(session)
}

/** Warehouse là actor vận hành duy nhất của Supplier Receipt trong Batch 1A. */
export function canOperateSupplierReceipt(session) {
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

/** Khách doanh nghiệp: không còn thao tác nghiệp vụ từ Admin giám sát. */
export function canManageCorporateCustomers(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
}

export function isBranchManager(session) {
  return hasPermission(session, 'MANAGE_EMPLOYEE') && !isSystemAdmin(session)
}

function isManagerRole(session) {
  if (isSystemAdmin(session) || isWarehouseRole(session)) return false
  return (session?.roles ?? []).some((role) => {
    const normalized = String(role || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
    return ['manager', 'agency manager', 'branch manager', 'owner', 'chu co so', 'chủ cơ sở'].includes(normalized)
  })
}

export function canViewContracts(session) {
  return hasPermission(session, 'VIEW_CUSTOMER') || hasPermission(session, 'MANAGE_ROLE')
}

export function canCreateContracts(session) {
  if (isBusinessOpsBlocked(session)) return false
  return Boolean(session?.userId)
}

export function canApproveContracts(session) {
  if (isBusinessOpsBlocked(session)) return false
  return isBranchManager(session) || isManagerRole(session)
}

/** Chỉ kế toán được tạo/sửa/ẩn/khôi phục nhà cung cấp và mặt hàng nhà cung cấp; Admin/thủ kho chỉ xem. */
export function canManageSuppliers(session) {
  return isAccountantRole(session)
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
