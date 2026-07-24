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
    return ['accountant', 'ke toan', 'káº¿ toÃ¡n'].includes(normalized)
  })
}

/** Káº¿ toÃ¡n chá»‰ xem kho â€” khÃ´ng táº¡o/duyá»‡t phiáº¿u, khÃ´ng chá»‰nh tá»“n. */
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

export function canCreateCustomer(session) {
  return hasPermission(session, 'CREATE_CUSTOMER')
}

/** Sá»­a há»“ sÆ¡ KH: Manager/Káº¿ toÃ¡n/Chá»§ HTX (VIEW_ALL_CUSTOMERS). Sale chá»‰ xem. */
export function canEditCustomer(session) {
  return hasPermission(session, 'CREATE_CUSTOMER') || hasPermission(session, 'MANAGE_ROLE')
}

/** Sale (hoáº·c NV chá»‰ cÃ³ VIEW_CUSTOMER): xem tá»‡p KH Ä‘Æ°á»£c gÃ¡n, khÃ´ng thÃªm/sá»­a há»“ sÆ¡. */
export function isAssignedCustomerViewer(session) {
  return canViewCustomer(session) && !canViewAllCustomers(session)
}

/** XÃ³a/khÃ´i phá»¥c KH â€” chá»‰ Admin. */
export function canDeleteCustomer(session) {
  return isCooperativeOwner(session)
}

/** Manager/Admin/Káº¿ toÃ¡n xem má»i Ä‘Æ¡n; Sale chá»‰ Ä‘Æ¡n do mÃ¬nh táº¡o (EmployeeId). */
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

/** Chá»‰ Thá»§ kho Ä‘Æ°á»£c táº¡o má»›i sáº£n pháº©m / danh má»¥c / SKU. */
export function canCreateCatalog(session) {
  return isWarehouseRole(session)
}

/** Chá»‰ Thá»§ kho Ä‘Æ°á»£c áº©n / kÃ­ch hoáº¡t láº¡i sáº£n pháº©m, danh má»¥c. */
export function canHideCatalog(session) {
  return canCreateCatalog(session)
}

export function canCreateProductDeletionRequest(session) {
  return isWarehouseRole(session)
}

export function canAccessWarehouseInventory(session) {
  return isWarehouseRole(session)
}

/** Chá»‰ Thá»§ kho Ä‘Æ°á»£c sá»­a sáº£n pháº©m, danh má»¥c, SKU. */
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

/** XÃ¡c nháº­n thanh toÃ¡n COD â€” chá»‰ dá»±a trÃªn action permission. */
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

export function isSalePosRole(session) {
  return (session?.roles ?? []).some((role) => {
    const key = normalizeRoleToken(role)
    return key === 'salepos' || key === 'sale'
  })
}

export function isSaleCodRole(session) {
  return (session?.roles ?? []).some((role) => normalizeRoleToken(role) === 'salecod')
}

/** TÆ°Æ¡ng thÃ­ch tÃªn helper cÅ©; quyáº¿t Ä‘á»‹nh COD-only dá»±a trÃªn permission union. */
export function isSaleCodOnlyRole(session) {
  return canViewOnlyCodOrders(session)
}

export function canViewOnlyCodOrders(session) {
  if (canViewAllOrders(session)) return false
  return canUsePosCodMode(session) && !canUsePosCounterMode(session)
}

/** Quáº§y POS: action permission Ä‘á»™c láº­p, há»— trá»£ union nhiá»u role. */
export function canUsePosCounterMode(session) {
  return hasPermission(session, 'CREATE_POS_ORDER')
}

/** BÃ¡n COD: action permission Ä‘á»™c láº­p vá»›i VERIFY_COD. */
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

/** Kiá»ƒm tra & quyáº¿t Ä‘á»‹nh xá»­ lÃ½ hÃ ng tráº£ (Restock/Quarantine/Dispose): Thá»§ kho, Quáº£n lÃ½, Admin. */
export function canInspectReturn(session) {
  return isWarehouseRole(session) || isBranchManager(session) || isManagerRole(session) || isSystemAdmin(session)
}

export function canCancelStockReplenishmentRequest(session) {
  return isBranchManager(session) || isManagerRole(session) || isWarehouseRole(session) || isSystemAdmin(session)

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

/** Chá»‰ Chá»§ há»£p tÃ¡c xÃ£ Ä‘Æ°á»£c táº¡o/sá»­a/xÃ³a khÃ¡ch doanh nghiá»‡p. */
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
    return ['manager', 'agency manager', 'branch manager', 'owner', 'chu co so', 'chá»§ cÆ¡ sá»Ÿ'].includes(normalized)
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

/** Chá»‰ Admin Ä‘Æ°á»£c táº¡o/sá»­a/áº©n/khÃ´i phá»¥c nhÃ  cung cáº¥p; káº¿ toÃ¡n vÃ  thá»§ kho chá»‰ xem. */
export function canManageSuppliers(session) {
  if (isSystemAdmin(session)) return true
  return (session?.roles ?? []).some(
    (r) => String(r || '').trim().toLowerCase() === 'admin',
  )
}

export function getStaffManagementScopeLabel(session) {
  if (isSystemAdmin(session)) return 'Quản lý tài khoản hệ thống: Chủ hợp tác xã. Quản lý nhân sự: Warehouse, Accountant, Manager, SalePos, SaleCod'
  if (isCooperativeOwner(session)) return 'Quản lý nhân sự: Manager, Warehouse, Accountant'
  if (isBranchManager(session)) return 'Quản lý nhân sự: SalePos, SaleCod'
  return 'Quáº£n lÃ½ nhÃ¢n sá»±'
}

/** Chá»§ HTX Ä‘Æ°á»£c Ä‘á»•i vai trÃ² trong pháº¡m vi Manager / Warehouse / Accountant. */
export function canChangeStaffRole(session) {
  return isCooperativeOwner(session)
}

export function canCreateStockReplenishmentRequest(session) {
  return isBranchManager(session) || isWarehouseRole(session)
}

export function canReviewStockReplenishmentRequest(session) {
  return isWarehouseRole(session) || isCooperativeOwner(session)
}

export function canCancelStockReplenishmentRequest(session) {
  return isBranchManager(session) || isWarehouseRole(session) || isSystemAdmin(session)
}

