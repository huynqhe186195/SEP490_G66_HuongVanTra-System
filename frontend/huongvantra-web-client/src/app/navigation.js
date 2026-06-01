const ROLE_GROUPS = {
  admin: ['admin'],
  agencyManager: ['agency manager', 'agencymanager', 'am', 'owner', 'chu co so', 'chủ cơ sở', 'branch manager'],
  salesStaff: ['sales staff', 'salesstaff', 'sale', 'sales', 'staff sale'],
  inventoryManager: ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho'],
  accountant: ['accountant', 'ke toan', 'kế toán'],
  customer: ['customer', 'khach hang', 'khách hàng'],
}

const HOME_MODULE_PRIORITY = [
  'dashboard',
  'pos',
  'inventory',
  'products',
  'orders',
  'customers',
  'reports',
  'staff',
  'contracts',
  'integrations',
]

export const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', module: 'dashboard', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'POS bán hàng', path: '/pos', module: 'pos', roles: ['admin', 'agencyManager', 'salesStaff', 'customer'] },
  { label: 'Đơn hàng', path: '/orders', module: 'orders', roles: ['admin', 'agencyManager'] },
  { label: 'Sản phẩm', path: '/products', module: 'products', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Kho', path: '/inventory', module: 'inventory', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Khách hàng', path: '/customers', module: 'customers', roles: ['admin', 'agencyManager'] },
  { label: 'Nhân sự', path: '/staff', module: 'staff', roles: ['admin', 'agencyManager'] },
  { label: 'Hợp đồng', path: '/contracts', module: 'contracts', roles: ['admin', 'agencyManager'] },
  { label: 'Báo cáo', path: '/reports', module: 'reports', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Tích hợp', path: '/integrations', module: 'integrations', roles: ['admin'] },
]

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

  const allowed = new Set(modules.map((module) => module.toLowerCase()))
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

  const allowed = new Set(modules.map((module) => module.toLowerCase()))

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

export function resolveHomeRoute(authSession) {
  if (!authSession) {
    return '/login'
  }

  const homeRoute = authSession.modules?.length
    ? getHomeRouteForModules(authSession.modules)
    : getHomeRouteForRoles(authSession.roles ?? [])

  return homeRoute === '/login' ? '/dashboard' : homeRoute
}

const MODULE_PATH_PREFIXES = [
  { module: 'integrations', prefix: '/integrations' },
  { module: 'reports', prefix: '/reports' },
  { module: 'contracts', prefix: '/contracts' },
  { module: 'staff', prefix: '/staff' },
  { module: 'customers', prefix: '/customers' },
  { module: 'inventory', prefix: '/inventory' },
  { module: 'products', prefix: '/products' },
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