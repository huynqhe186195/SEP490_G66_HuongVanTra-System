const ROLE_GROUPS = {
  admin: ['admin'],
  agencyManager: ['agency manager', 'agencymanager', 'am', 'owner', 'chu co so', 'chủ cơ sở', 'branch manager'],
  salesStaff: ['sales staff', 'salesstaff', 'sale', 'sales', 'staff sale'],
  inventoryManager: ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho'],
  accountant: ['accountant', 'ke toan', 'kế toán'],
  customer: ['customer', 'khach hang', 'khách hàng'],
}

/** Tạm ẩn trên sidebar — bật lại khi backend sẵn sàng. */
const SIDEBAR_DISABLED_MODULES = new Set([
  'dashboard',
  'products',
  'inventory',
  'contracts',
  'reports',
  'integrations',
])

const HOME_MODULE_PRIORITY = [
  'pos',
  'cod_ops',
  'orders',
  'customers',
  'staff',
]

// --- Tạm ẩn (chưa xử lý backend) ---
// { label: 'Dashboard', path: '/dashboard', module: 'dashboard', roles: ['admin', 'agencyManager', 'accountant'] },
// { label: 'Sản phẩm', path: '/products', module: 'products', roles: ['admin', 'agencyManager', 'inventoryManager'] },
// { label: 'Kho', path: '/inventory', module: 'inventory', roles: ['admin', 'agencyManager', 'inventoryManager'] },
// { label: 'Hợp đồng', path: '/contracts', module: 'contracts', roles: ['admin', 'agencyManager'] },
// { label: 'Báo cáo', path: '/reports', module: 'reports', roles: ['admin', 'agencyManager', 'accountant'] },
// { label: 'Tích hợp', path: '/integrations', module: 'integrations', roles: ['admin'] },

export const navigationItems = [
  { label: 'POS bán hàng', path: '/pos', module: 'pos', icon: 'point_of_sale', roles: ['agencyManager', 'salesStaff', 'customer'] },
  { label: 'Đơn hàng', path: '/orders', module: 'orders', icon: 'receipt_long', roles: ['admin', 'agencyManager', 'salesStaff'] },
  { label: 'Quản lý COD', path: '/orders/cod', module: 'cod_ops', icon: 'local_shipping', roles: ['agencyManager'] },
  { label: 'Khách hàng', path: '/customers', module: 'customers', icon: 'groups', roles: ['admin', 'agencyManager'] },
  { label: 'Nhân sự', path: '/staff', module: 'staff', icon: 'badge', roles: ['admin', 'agencyManager'] },
]

function isSidebarModuleEnabled(module) {
  return !SIDEBAR_DISABLED_MODULES.has(String(module || '').toLowerCase())
}

function normalizeRole(role) {
  return role.trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function hasAnyRoleGroup(userRoles, allowedGroups) {
  const normalizedUserRoles = userRoles.map(normalizeRole)

  return allowedGroups.some((groupKey) => {
    const aliases = ROLE_GROUPS[groupKey]
    if (!aliases) {
      return normalizedUserRoles.includes(normalizeRole(groupKey))
    }

    return aliases.some((alias) => normalizedUserRoles.includes(normalizeRole(alias)))
  })
}

export function getNavigationItemsForModules(modules = []) {
  if (!modules.length) {
    return []
  }

  const allowed = new Set(
    modules.map((module) => module.toLowerCase()).filter(isSidebarModuleEnabled),
  )
  return navigationItems.filter((item) => allowed.has(item.module))
}

export function getNavigationItemsForRoles(roles = []) {
  if (!roles.length) {
    return []
  }

  return navigationItems.filter((item) => hasAnyRoleGroup(roles, item.roles))
}

export function getNavigationItemsForSession(session) {
  if (session?.modules?.length) {
    return getNavigationItemsForModules(session.modules)
  }

  return getNavigationItemsForRoles(session?.roles ?? [])
}

export function getHomeRouteForModules(modules = []) {
  if (!modules.length) {
    return '/login'
  }

  const allowed = new Set(
    modules.map((module) => module.toLowerCase()).filter(isSidebarModuleEnabled),
  )

  for (const module of HOME_MODULE_PRIORITY) {
    if (!allowed.has(module)) {
      continue
    }

    const item = navigationItems.find((entry) => entry.module === module)
    if (item) {
      return item.path
    }
  }

  const firstItem = getNavigationItemsForModules(modules)[0]
  return firstItem?.path ?? '/login'
}

export function getHomeRouteForRoles(roles = []) {
  const items = getNavigationItemsForRoles(roles)
  if (items.length) {
    return items[0].path
  }

  if (!roles.length) {
    return '/login'
  }

  return '/profile'
}

export function resolveHomeRoute(authSession) {
  if (!authSession) {
    return '/login'
  }

  const homeRoute = authSession.modules?.length
    ? getHomeRouteForModules(authSession.modules)
    : getHomeRouteForRoles(authSession.roles ?? [])

  if (homeRoute === '/login') {
    const items = getNavigationItemsForSession(authSession)
    return items[0]?.path ?? '/profile'
  }

  return homeRoute
}

const MODULE_PATH_PREFIXES = [
  { module: 'integrations', prefix: '/integrations' },
  { module: 'reports', prefix: '/reports' },
  { module: 'contracts', prefix: '/contracts' },
  { module: 'staff', prefix: '/staff' },
  { module: 'customers', prefix: '/customers' },
  { module: 'inventory', prefix: '/inventory' },
  { module: 'products', prefix: '/products' },
  { module: 'cod_ops', prefix: '/orders/cod' },
  { module: 'orders', prefix: '/orders' },
  { module: 'pos', prefix: '/pos' },
  { module: 'dashboard', prefix: '/dashboard' },
]

export function getModuleForPath(pathname) {
  const path = pathname.toLowerCase()

  for (const { module, prefix } of MODULE_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return module
    }
  }

  return null
}

export function canAccessModule(session, module) {
  if (!module) {
    return true
  }

  if (!isSidebarModuleEnabled(module)) {
    return false
  }

  if (session?.modules?.length) {
    return session.modules.some((entry) => entry.toLowerCase() === module)
  }

  if (session?.roles?.length) {
    const item = navigationItems.find((entry) => entry.module === module)
    return item ? hasAnyRoleGroup(session.roles, item.roles) : false
  }

  return false
}

export function canAccessPath(session, pathname) {
  const module = getModuleForPath(pathname)
  return canAccessModule(session, module)
}

export function getAccessDeniedMessage(pathname) {
  const module = getModuleForPath(pathname)
  if (module === 'cod_ops') {
    return 'Chỉ Quản lý chi nhánh mới được truy cập Quản lý COD.'
  }
  return 'Bạn không có quyền truy cập trang này.'
}

/** Sidebar highlight: /orders/cod must not activate the /orders item. */
export function isNavigationItemActive(pathname, item) {
  const path = (pathname || '').toLowerCase()
  const target = (item?.path || '').toLowerCase()

  if (!target) {
    return false
  }

  if (item.module === 'cod_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'orders') {
    if (path === '/orders/cod' || path.startsWith('/orders/cod/')) {
      return false
    }
    return path === target || path.startsWith(`${target}/`)
  }

  return path === target || path.startsWith(`${target}/`)
}
