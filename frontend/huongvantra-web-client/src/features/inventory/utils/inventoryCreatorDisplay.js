export const UNKNOWN_CREATOR_VALUE = 'Chưa xác định'

function normalizeRoleKey(roleName) {
  return String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export function formatCreatorRole(roleName) {
  const trimmed = String(roleName || '').trim()
  if (!trimmed) return UNKNOWN_CREATOR_VALUE

  const roleMap = {
    warehouse: 'Thủ kho Kho tổng',
    warehousestaff: 'Thủ kho Kho tổng',
    inventorystaff: 'Thủ kho Kho tổng',
    inventorymanager: 'Thủ kho Kho tổng',
    manager: 'Quản lý',
    agencymanager: 'Quản lý',
    admin: 'Quản trị viên',
    administrator: 'Quản trị viên',
    sale: 'Nhân viên bán hàng',
    salesstaff: 'Nhân viên bán hàng',
  }

  return roleMap[normalizeRoleKey(trimmed)] || trimmed
}
