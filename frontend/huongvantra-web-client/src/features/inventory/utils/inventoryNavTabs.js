import { isWarehouseRole } from '../../auth/utils/permissions.js'

export const warehouseNavTabs = [
  { label: 'Kho tổng', to: '/inventory' },
  { label: 'Theo lô', to: '/inventory/batches' },
  { label: 'Nhập lô', to: '/inventory/import' },
  { label: 'Phiếu xuất', to: '/inventory/export' },
  { label: 'Lệnh SX', to: '/inventory/production-orders' },
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

  return path === target || path.startsWith(`${target}/`)
}
