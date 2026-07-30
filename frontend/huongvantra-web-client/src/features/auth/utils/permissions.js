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

export function canWriteInventory(session) {
  if (isAccountantRole(session)) return false
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session) || isSystemAdmin(session)
}

export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

export function canViewAllCustomers(session) {
  return hasPermission(session, 'VIEW_ALL_CUSTOMERS')
}

export function canViewCustomer(session) {
  return hasPermission(session, 'VIEW_CUSTOMER')
}

/** Tạo hồ sơ KH: Manager/Admin và cả Sale (CREATE_ORDER) — một KH có thể mua qua nhiều Sale. */
export function canCreateCustomer(session) {
  return (
    hasPermission(session, 'CREATE_CUSTOMER')
    || hasPermission(session, 'CREATE_ORDER')
    || hasPermission(session, 'MANAGE_ROLE')
  )
}

export function canEditCustomer(session) {
  return hasPermission(session, 'CREATE_CUSTOMER') || hasPermission(session, 'MANAGE_ROLE')
}

/** Sale (hoặc NV chỉ có VIEW_CUSTOMER): xem toàn bộ khách trong cửa hàng, thêm được nhưng không sửa hồ sơ. */
export function isReadOnlyCustomerViewer(session) {
  return canViewCustomer(session) && !canViewAllCustomers(session)
}

export function canDeleteCustomer(session) {
  return isCooperativeOwner(session)
}

export function canViewAllOrders(session) {
  return (
    hasPermission(session, 'VIEW_ALL_CUSTOMERS')
    || hasPermission(session, 'MANAGE_EMPLOYEE')
  )
}

export function canSimulateOrderCompleted(session) {
  return hasPermission(session, 'CREATE_ORDER')
}

export function canManageCatalog(session) {
  if (hasPermission(session, 'MANAGE_CATALOG')) {
    return true
  }
  return isWarehouseRole(session)
}

export function canCreateCatalog(session) {
  return isWarehouseRole(session)
}

export function canHideCatalog(session) {
  return canCreateCatalog(session)
}

export function canCreateProductDeletionRequest(session) {
  return isWarehouseRole(session)
}

export function canAccessWarehouseInventory(session) {
  return isWarehouseRole(session)
}

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

export function canVerifyCodPayment(session) {
  return hasPermission(session, 'VERIFY_COD')
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

/** Trang Accounting: chỉ principal có role Admin được sửa Giá bán. */
export function canEditAccountingSalePrice(session) {
  return hasAdminRole(session)
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

export function isSaleCodOnlyRole(session) {
  return canViewOnlyCodOrders(session)
}

export function canViewOnlyCodOrders(session) {
  if (canViewAllOrders(session)) return false
  return canUsePosCodMode(session) && !canUsePosCounterMode(session)
}

/** Quầy POS: SalePos (CREATE_POS_ORDER) hoặc Manager. */
export function canUsePosCounterMode(session) {
  return hasPermission(session, 'CREATE_POS_ORDER')
    || isBranchManager(session)
    || isManagerRole(session)
}

export function canUsePosCodMode(session) {
  return hasPermission(session, 'CREATE_COD_ORDER')
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

export function canInspectReturn(session) {
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session) || isSystemAdmin(session)
}

export function canCancelStockReplenishmentRequest(session) {
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session) || isSystemAdmin(session)

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

export function isCooperativeOwner(session) {
  return hasPermission(session, 'APPROVE_CONTRACT')
}

export function canApprovePrice(session) {
  return hasPermission(session, 'APPROVE_PRICE')
}

export function canManageBusinessPolicy(session) {
  return hasPermission(session, 'MANAGE_BUSINESS_POLICY')
}

export function canManageCorporateCustomers(session) {
  return isCooperativeOwner(session)
}

export function isBranchManager(session) {
  return hasPermission(session, 'MANAGE_EMPLOYEE') && !isCooperativeOwner(session) && !isSystemAdmin(session)
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
  return isCooperativeOwner(session)
}

export function canManageSuppliers(session) {
  if (isSystemAdmin(session)) return true
  return (session?.roles ?? []).some(
    (r) => String(r || '').trim().toLowerCase() === 'admin',
  )
}

export function getStaffManagementScopeLabel(session) {
  if (isSystemAdmin(session)) return 'Quản lý nhân sự: Manager'
  if (isBranchManager(session)) return 'Quản lý nhân sự: SalePos, SaleCod'
  return 'Quản lý nhân sự'
}

export function canChangeStaffRole(session) {
  return isCooperativeOwner(session)
}

