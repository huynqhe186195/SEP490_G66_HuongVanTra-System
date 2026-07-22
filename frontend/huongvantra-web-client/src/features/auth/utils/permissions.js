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

/** Kế toán chỉ xem kho — không tạo/duyệt phiếu, không chỉnh tồn. */
export function canWriteInventory(session) {
  if (isAccountantRole(session)) return false
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session) || isSystemAdmin(session)
}

export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

export function canViewAllCustomers(session) {
  return hasPermission(session, 'VIEW_ALL_CUSTOMERS') || hasPermission(session, 'MANAGE_ROLE')
}

export function canViewCustomer(session) {
  return hasPermission(session, 'VIEW_CUSTOMER')
}

export function canCreateCustomer(session) {
  return hasPermission(session, 'CREATE_CUSTOMER')
}

/** Sửa hồ sơ KH: Admin (MANAGE_ROLE) hoặc Manager (CREATE_CUSTOMER). Kế toán chỉ xem. */
export function canEditCustomer(session) {
  return hasPermission(session, 'CREATE_CUSTOMER') || hasPermission(session, 'MANAGE_ROLE')
}

/** Sale (hoặc NV chỉ có VIEW_CUSTOMER): xem tệp KH được gán, không thêm/sửa hồ sơ. */
export function isAssignedCustomerViewer(session) {
  return canViewCustomer(session) && !canViewAllCustomers(session)
}

/** Xóa/khôi phục KH — chỉ Admin. */
export function canDeleteCustomer(session) {
  return hasPermission(session, 'MANAGE_ROLE')
}

/** Manager/Admin/Kế toán xem mọi đơn; Sale chỉ đơn do mình tạo (EmployeeId). */
export function canViewAllOrders(session) {
  return (
    hasPermission(session, 'VIEW_ALL_CUSTOMERS')
    || hasPermission(session, 'MANAGE_EMPLOYEE')
    || hasPermission(session, 'MANAGE_ROLE')
  )
}

export function canSimulateOrderCompleted(session) {
  return hasPermission(session, 'CREATE_ORDER')
}

export function canManageCatalog(session) {
  if (hasPermission(session, 'MANAGE_CATALOG') || hasPermission(session, 'MANAGE_ROLE')) {
    return true
  }
  return isWarehouseRole(session)
}

/** Chỉ Thủ kho được tạo mới sản phẩm / danh mục / SKU. */
export function canCreateCatalog(session) {
  return isWarehouseRole(session)
}

/** Chỉ Thủ kho được ẩn / kích hoạt lại sản phẩm, danh mục. */
export function canHideCatalog(session) {
  return canCreateCatalog(session)
}

export function canCreateProductDeletionRequest(session) {
  return isWarehouseRole(session)
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
  return hasPermission(session, 'CREATE_ORDER')
}

export function canAdjustStoreStock(session) {
  return canCreateStockReplenishmentRequest(session)
}

export function canCreateStockReplenishmentRequest(session) {
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session) || isSystemAdmin(session)
}

export function canReviewStockReplenishmentRequest(session) {
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session) || isSystemAdmin(session)
}

export function canCancelStockReplenishmentRequest(session) {
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session) || isSystemAdmin(session)
}

export function isSystemAdmin(session) {
  return hasPermission(session, 'MANAGE_ROLE')
}

/** Chỉ Admin (MANAGE_ROLE) được tạo/sửa/xóa khách doanh nghiệp. */
export function canManageCorporateCustomers(session) {
  return isSystemAdmin(session)
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
  return hasPermission(session, 'VIEW_CUSTOMER')
}

export function canCreateContracts(session) {
  return Boolean(session?.userId)
}

export function canApproveContracts(session) {
  return isSystemAdmin(session)
}

/** Chỉ Admin được tạo/sửa/ẩn/khôi phục nhà cung cấp; kế toán và thủ kho chỉ xem. */
export function canManageSuppliers(session) {
  if (isSystemAdmin(session)) return true
  return (session?.roles ?? []).some(
    (r) => String(r || '').trim().toLowerCase() === 'admin',
  )
}

export function getStaffManagementScopeLabel(session) {
  if (isSystemAdmin(session)) return 'Quản lý nhân sự: Warehouse, Accountant, Manager'
  if (isBranchManager(session)) return 'Quản lý nhân sự: Sale'
  return 'Quản lý nhân sự'
}
