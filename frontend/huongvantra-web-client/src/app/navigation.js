const ROLE_GROUPS = {
  admin: ['admin'],
  agencyManager: ['agency manager', 'agencymanager', 'am', 'owner', 'chu co so', 'chủ cơ sở', 'branch manager', 'manager'],
  salesStaff: ['sales staff', 'salesstaff', 'sale', 'sales', 'staff sale'],
  inventoryManager: ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho', 'warehouse'],
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
  'stock_deduct_ops',
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
  {
    label: 'Chờ trừ kho',
    path: '/orders/stock-deduct',
    module: 'stock_deduct_ops',
    icon: 'inventory_2',
    roles: ['admin', 'agencyManager', 'inventoryManager'],
  },
  { label: 'Khách hàng', path: '/customers', module: 'customers', icon: 'groups', roles: ['admin', 'agencyManager'] },
  { label: 'Nhân sự', path: '/staff', module: 'staff', icon: 'badge', roles: ['admin', 'agencyManager'] },
  {
    label: 'Hạng thẻ',
    path: '/admin/membership-tiers',
    module: 'membership_tiers_admin',
    icon: 'military_tech',
    roles: ['admin'],
  },
  {
    label: 'Mã giảm giá',
    path: '/admin/promotions',
    module: 'promotions_admin',
    icon: 'sell',
    roles: ['admin'],
  },
  {
    label: 'Tài khoản',
    path: '/admin/users',
    module: 'users_admin',
    icon: 'manage_accounts',
    roles: ['admin'],
  },
  {
    label: 'Phân quyền',
    path: '/admin/phan-quyen',
    module: 'phan_quyen_admin',
    icon: 'shield_person',
    roles: ['admin'],
  },
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
  { module: 'membership_tiers_admin', prefix: '/admin/membership-tiers' },
  { module: 'promotions_admin', prefix: '/admin/promotions' },
  { module: 'users_admin', prefix: '/admin/users' },
  { module: 'phan_quyen_admin', prefix: '/admin/phan-quyen' },
  { module: 'customers', prefix: '/customers' },
  { module: 'inventory', prefix: '/inventory' },
  { module: 'products', prefix: '/products' },
  { module: 'cod_ops', prefix: '/orders/cod' },
  { module: 'stock_deduct_ops', prefix: '/orders/stock-deduct' },
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
    const normalizedModule = String(module).toLowerCase()
    if (session.modules.some((entry) => entry.toLowerCase() === normalizedModule)) {
      return true
    }

    const item = navigationItems.find((entry) => entry.module === normalizedModule)
    if (item && session?.roles?.length) {
      return hasAnyRoleGroup(session.roles, item.roles)
    }

    return false
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

/** Xem danh sách / preview hàng chờ trừ kho (quản lý chi nhánh + thủ kho). */
export function canViewStockDeductOps(session) {
  return canAccessModule(session, 'stock_deduct_ops')
}

/** Xác nhận trừ kho — chỉ Admin và Thủ kho. */
export function canConfirmStockDeduct(session) {
  if (!session?.roles?.length) {
    return false
  }

  return hasAnyRoleGroup(session.roles, ['admin', 'inventoryManager'])
}

export function getAccessDeniedMessage(pathname) {
  const module = getModuleForPath(pathname)
  if (module === 'cod_ops') {
    return 'Chỉ Quản lý chi nhánh mới được truy cập Quản lý COD.'
  }
  if (module === 'stock_deduct_ops') {
    return 'Chỉ Quản lý chi nhánh hoặc Thủ kho mới được xem hàng chờ trừ kho. Thao tác trừ kho do Thủ kho thực hiện.'
  }
  if (module === 'promotions_admin' || module === 'membership_tiers_admin') {
    return 'Chỉ Admin mới được quản lý hạng thẻ và mã giảm giá.'
  }
  if (module === 'users_admin' || module === 'phan_quyen_admin') {
    return 'Chỉ Quản trị viên mới được quản lý tài khoản và phân quyền.'
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

  if (item.module === 'stock_deduct_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'orders') {
    if (path === '/orders/cod' || path.startsWith('/orders/cod/')) {
      return false
    }
    if (path === '/orders/stock-deduct' || path.startsWith('/orders/stock-deduct/')) {
      return false
    }
    return path === target || path.startsWith(`${target}/`)
  }

  return path === target || path.startsWith(`${target}/`)
}
