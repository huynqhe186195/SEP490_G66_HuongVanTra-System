const ROLE_GROUPS = {
  admin: ['admin'],
  agencyManager: ['agency manager', 'agencymanager', 'am', 'owner', 'chu co so', 'chủ cơ sở', 'branch manager'],
  salesStaff: ['sales staff', 'salesstaff', 'sale', 'sales', 'staff sale'],
  inventoryManager: ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho'],
  accountant: ['accountant', 'ke toan', 'kế toán'],
  customer: ['customer', 'khach hang', 'khách hàng'],
}

export const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'agencyManager', 'salesStaff', 'inventoryManager', 'accountant'] },
  { label: 'POS bán hàng', path: '/pos', roles: ['admin', 'agencyManager', 'salesStaff', 'customer'] },
  { label: 'Đơn hàng', path: '/orders', roles: ['admin', 'agencyManager', 'salesStaff', 'inventoryManager'] },
  { label: 'Sản phẩm', path: '/products', roles: ['admin', 'agencyManager', 'salesStaff', 'inventoryManager'] },
  { label: 'Kho', path: '/inventory', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Khách hàng', path: '/customers', roles: ['admin', 'agencyManager', 'salesStaff'] },
  { label: 'Nhân sự', path: '/staff', roles: ['admin', 'agencyManager'] },
  { label: 'Hợp đồng', path: '/contracts', roles: ['admin', 'agencyManager'] },
  { label: 'Báo cáo', path: '/reports', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Tích hợp', path: '/integrations', roles: ['admin'] },
]

function normalizeRole(role) {
  return role.trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function hasRole(roles, candidateRoles) {
  const normalizedRoles = roles.map(normalizeRole)
  return candidateRoles.some((candidateRole) => normalizedRoles.includes(normalizeRole(candidateRole)))
}

export function getNavigationItemsForRoles(roles = []) {
  if (!roles.length) {
    return []
  }

  return navigationItems.filter((item) => hasRole(roles, item.roles))
}

export function getHomeRouteForRoles(roles = []) {
  if (!roles.length) {
    return '/login'
  }

  const normalizedRoles = roles.map(normalizeRole)

  if (normalizedRoles.some((role) => ROLE_GROUPS.admin.includes(role))) {
    return '/dashboard'
  }

  if (normalizedRoles.some((role) => ROLE_GROUPS.agencyManager.includes(role))) {
    return '/dashboard'
  }

  if (normalizedRoles.some((role) => ROLE_GROUPS.inventoryManager.includes(role))) {
    return '/inventory'
  }

  if (normalizedRoles.some((role) => ROLE_GROUPS.salesStaff.includes(role))) {
    return '/pos'
  }

  if (normalizedRoles.some((role) => ROLE_GROUPS.accountant.includes(role))) {
    return '/reports'
  }

  if (normalizedRoles.some((role) => ROLE_GROUPS.customer.includes(role))) {
    return '/pos'
  }

  return '/dashboard'
}