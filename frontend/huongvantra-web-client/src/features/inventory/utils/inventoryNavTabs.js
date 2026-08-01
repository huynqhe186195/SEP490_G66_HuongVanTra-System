import { isSystemAdmin, isWarehouseRole, isAccountantRole } from '../../auth/utils/permissions.js'

export const warehouseNavTabs = [
  { label: 'Kho', to: '/inventory' },
  { label: 'Lô hàng nhập', to: '/inventory/batches' },
  { label: 'Phiếu nhập kho', to: '/inventory/import' },
  { label: 'Phiếu xuất kho', to: '/inventory/export' },
  { label: 'Kiểm kê tồn kho', to: '/inventory/stocktake' },
  { label: 'Báo cáo kho', to: '/inventory/reports' },
  { label: 'Quản lý lệnh sản xuất', to: '/inventory/production-orders' },
  { label: 'Định mức BOM', to: '/inventory/boms' },
]

export const stockRequestNavTab = {
  label: 'Yêu cầu bổ sung Kệ Hàng',
  to: '/inventory/stock-requests',
}

export const stockTransferNavTab = {
  label: 'Phiếu điều chuyển Kho → Kệ',
  to: '/inventory/stock-transfers',
}

export const shelfReplenishmentSuggestionNavTab = {
  label: 'Gợi ý bổ sung Kệ Hàng',
  to: '/inventory/shelf-replenishment-suggestions',
}

export const supplierReceiptNavTab = {
  label: 'Phiếu nhập nhà cung cấp',
  to: '/inventory/supplier-receipts',
}

export const inventoryLedgerNavTab = {
  label: 'Nhật ký kho',
  to: '/inventory/ledger',
}

export const inventoryReturnNavTab = {
  label: 'Trả hàng nhập',
  to: '/inventory/returns',
}

export const returnInspectionNavTab = {
  label: 'Kiểm tra hàng trả',
  to: '/inventory/return-inspections',
}

export const stocktakeNavTab = {
  label: 'Kiểm kê tồn kho',
  to: '/inventory/stocktake',
}

export const inventoryReportNavTab = {
  label: 'Báo cáo kho',
  to: '/inventory/reports',
}

/** @deprecated use getInventoryNavTabs(session) */
export const inventoryNavTabs = [
  ...warehouseNavTabs,
  supplierReceiptNavTab,
  inventoryReturnNavTab,
  returnInspectionNavTab,
  inventoryLedgerNavTab,
  stockRequestNavTab,
  stockTransferNavTab,
]

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function isManagerLike(session) {
  return (session?.roles ?? []).some((role) => ['manager', 'agency manager', 'branch manager', 'owner'].includes(normalizeRole(role)))
}

function isAdminLike(session) {
  return (session?.roles ?? []).some((role) => normalizeRole(role) === 'admin')
}

export function getInventoryNavTabs(session) {
  const tabs = []
  const accountant = isAccountantRole(session)

  if (isWarehouseRole(session)) {
    tabs.push(...warehouseNavTabs)
  }
  if (isSystemAdmin(session) || isManagerLike(session) || isWarehouseRole(session) || accountant) {
    tabs.push(supplierReceiptNavTab)
  }
  if (isSystemAdmin(session) || isManagerLike(session) || isWarehouseRole(session)) {
    tabs.push(inventoryReturnNavTab)
    tabs.push(returnInspectionNavTab)
  }
  if (!isWarehouseRole(session) && (isSystemAdmin(session) || isManagerLike(session))) {
    tabs.push(stocktakeNavTab)
  }
  if (!isWarehouseRole(session) && (isSystemAdmin(session) || isManagerLike(session) || accountant)) {
    tabs.push(inventoryReportNavTab)
  }
  if (isSystemAdmin(session) || isManagerLike(session) || isWarehouseRole(session) || accountant) {
    tabs.push(inventoryLedgerNavTab)
  }
  // Kế toán không tham gia luồng bổ sung Kệ Hàng.
  if (!accountant) {
    tabs.push(stockRequestNavTab)
  }
  if (isWarehouseRole(session) || isManagerLike(session) || isAdminLike(session) || isSystemAdmin(session)) {
    tabs.push(stockTransferNavTab)
    tabs.push(shelfReplenishmentSuggestionNavTab)
  }
  return tabs
}

export function isInventoryNavTabActive(pathname, tabTo) {
  const path = (pathname || '').replace(/\/$/, '') || '/'
  const target = (tabTo || '').replace(/\/$/, '') || '/'

  if (target === '/inventory') {
    return path === '/inventory'
  }

  if (target === '/inventory/import') {
    return path === target
  }

  return path === target || path.startsWith(`${target}/`)
}
