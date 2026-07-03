import { isWarehouseRole } from '../../auth/utils/permissions.js'

export const warehouseNavTabs = [
  { label: 'Kho tổng', to: '/inventory' },
  { label: 'Theo lô', to: '/inventory/batches' },
  { label: 'Phiếu nhập kho', to: '/inventory/import' },
  { label: 'Nhập nguyên liệu', to: '/inventory/import/create' },
  { label: 'Phiếu xuất', to: '/inventory/export' },
  { label: 'Lô SX', to: '/inventory/production-orders' },
  { label: 'Định mức BOM', to: '/inventory/boms' },
]

export const stockRequestNavTab = {
  label: 'Yêu cầu tồn',
  to: '/inventory/stock-requests',
}

/** @deprecated use getInventoryNavTabs(session) */
export const inventoryNavTabs = [...warehouseNavTabs, stockRequestNavTab]

export function getInventoryNavTabs(session) {
  const tabs = []
  if (isWarehouseRole(session)) {
    tabs.push(...warehouseNavTabs)
  }
  tabs.push(stockRequestNavTab)
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
