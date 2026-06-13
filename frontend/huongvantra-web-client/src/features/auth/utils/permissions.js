import { isWarehouseUserRole } from '../services/authApi.js'

export function isWarehouseRole(session) {
  return isWarehouseUserRole(session?.roles ?? [])
}

export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

export function canViewAllCustomers(session) {
  return hasPermission(session, 'VIEW_ALL_CUSTOMERS') || hasPermission(session, 'MANAGE_ROLE')
}

/** Quản lý hồ sơ KH trên trang /customers (tạo/sửa/xóa). Sale chỉ xem; tạo tại POS vẫn dùng API create. */
export function canEditCustomer(session) {
  return canViewAllCustomers(session)
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
  return hasPermission(session, 'VIEW_ORDER') || hasPermission(session, 'MANAGE_ROLE')
}
