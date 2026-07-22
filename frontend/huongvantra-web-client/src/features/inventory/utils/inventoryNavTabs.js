import { isSystemAdmin, isWarehouseRole, isAccountantRole } from '../../auth/utils/permissions.js'

export const warehouseNavTabs = [
  { label: 'Kho', to: '/inventory' },
  { label: 'Theo lô', to: '/inventory/batches' },
  { label: 'Phiếu nhập kho', to: '/inventory/import' },
  { label: 'Nhập nguyên liệu', to: '/inventory/import/create' },
  { label: 'Phiếu xuất', to: '/inventory/export' },
  { label: 'Kiểm kê', to: '/inventory/stocktake' },
  { label: 'Báo cáo', to: '/inventory/reports' },
  { label: 'Lệnh SX', to: '/inventory/production-orders' },
  { label: 'Định mức BOM', to: '/inventory/boms' },
]

export const stockRequestNavTab = {
  label: 'Bổ sung Kệ Hàng',
  to: '/inventory/stock-requests',
}

export const supplierReceiptNavTab = {
  label: 'Nhập NCC',
  to: '/inventory/supplier-receipts',
}

export const inventoryLedgerNavTab = {
  label: 'Sổ kho',
  to: '/inventory/ledger',
}

export const inventoryReturnNavTab = {
  label: 'Trả hàng nhập',
  to: '/inventory/returns',
}

export const stocktakeNavTab = {
  label: 'Kiểm kê',
  to: '/inventory/stocktake',
}

export const inventoryReportNavTab = {
  label: 'Báo cáo',
  to: '/inventory/reports',
}

/** @deprecated use getInventoryNavTabs(session) */
export const inventoryNavTabs = [
  ...warehouseNavTabs,
  supplierReceiptNavTab,
  inventoryReturnNavTab,
  inventoryLedgerNavTab,
  stockRequestNavTab,
]

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function isManagerLike(session) {
  return (session?.roles ?? []).some((role) => ['manager', 'agency manager', 'branch manager', 'owner'].includes(normalizeRole(role)))
}

export function getInventoryNavTabs(session) {
  const tabs = []
  const accountant = isAccountantRole(session)

  if (isWarehouseRole(session)) {
    tabs.push(...warehouseNavTabs)
  }
  if (isSystemAdmin(session) || isManagerLike(session) || accountant) {
    tabs.push(supplierReceiptNavTab)
  }
  if (isSystemAdmin(session) || isManagerLike(session) || isWarehouseRole(session)) {
    tabs.push(inventoryReturnNavTab)
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
  // Kế toán không thao tác bổ sung kệ
  if (!accountant) {
    tabs.push(stockRequestNavTab)
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
