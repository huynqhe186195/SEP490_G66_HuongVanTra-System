import { buildDashboardPath, DASHBOARD_SECTIONS, getDashboardSectionFromSearch } from './dashboardSections.js'
import { buildCustomerPath, CUSTOMER_SIDEBAR_SECTIONS, getCustomerSectionFromSearch } from './customerSections.js'

const ROLE_GROUPS = {
  admin: ['admin'],
  agencyManager: ['agency manager', 'agencymanager', 'am', 'owner', 'chu co so', 'chủ cơ sở', 'branch manager', 'manager'],
  salesStaff: ['sales staff', 'salesstaff', 'sale', 'sales', 'staff sale', 'salepos', 'sale pos', 'salecod', 'sale cod'],
  salePos: ['salepos', 'sale pos', 'sale'],
  saleCod: ['salecod', 'sale cod'],
  inventoryManager: ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho', 'warehouse'],
  accountant: ['accountant', 'ke toan', 'kế toán'],
  customer: ['customer', 'khach hang', 'khách hàng'],
}

/** Tạm ẩn trên sidebar — bật lại khi backend sẵn sàng. */
const SIDEBAR_DISABLED_MODULES = new Set([
  'reports',
  'integrations',
])

const HOME_MODULE_PRIORITY = [
  'pos',
  'cod_ops',
  'stock_deduct_ops',
  'orders',
  'customers',
  'products',
  'stock_adjustment_ops',
  'supplier_receipts',
  'inventory_returns',
  'inventory_ledger',
  'inventory',
  'staff',
]

// --- Tạm ẩn (chưa xử lý backend) ---
// { label: 'Sản phẩm', path: '/products', module: 'products', roles: ['admin', 'agencyManager', 'inventoryManager'] },
// { label: 'Hợp đồng', path: '/contracts', module: 'contracts', roles: ['admin', 'agencyManager'] },
// { label: 'Báo cáo', path: '/reports', module: 'reports', roles: ['admin', 'agencyManager', 'accountant'] },
// { label: 'Tích hợp', path: '/integrations', module: 'integrations', roles: ['admin'] },

export const navigationItems = [
  { label: 'POS bán hàng', path: '/pos', module: 'pos', icon: 'point_of_sale', roles: ['agencyManager', 'salesStaff', 'customer'] },
  { label: 'Đơn hàng', path: '/orders', module: 'orders', icon: 'receipt_long', roles: ['admin', 'agencyManager', 'salePos', 'accountant'] },
  { label: 'Trả / đổi hàng', path: '/orders/exchange', module: 'orders', icon: 'swap_horiz', roles: ['admin', 'agencyManager', 'salePos', 'saleCod', 'accountant'] },
  { label: 'Quản lý đơn COD', path: '/orders/cod', module: 'cod_ops', icon: 'local_shipping', roles: ['agencyManager', 'saleCod'] },
  {
    label: 'Chờ trừ tồn quầy',
    path: '/orders/stock-deduct',
    module: 'stock_deduct_ops',
    icon: 'inventory_2',
    roles: ['admin', 'agencyManager'],
  },
  {
    label: 'Khách hàng',
    path: '/customers',
    module: 'customers',
    icon: 'groups',
    roles: ['admin', 'agencyManager', 'salesStaff', 'accountant'],
    children: CUSTOMER_SIDEBAR_SECTIONS.map((section) => ({
      label: section.label,
      path: buildCustomerPath(section.key),
      section: section.key,
      sectionScope: 'customers',
    })),
  },
  { label: 'Hợp đồng', path: '/contracts', module: 'contracts', icon: 'description', roles: ['admin', 'agencyManager'] },
  { label: 'Sản phẩm & Số lượng', path: '/inventory/products', module: 'products', icon: 'inventory_2', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Danh Mục Sản Phẩm', path: '/products/categories', module: 'products', icon: 'category', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Lịch sử tạo hàng hóa', path: '/inventory/product-approvals', module: 'product_creation_requests', icon: 'verified', roles: ['admin', 'inventoryManager'] },
  { label: 'Yêu cầu xóa hàng hóa', path: '/inventory/product-deletion-requests', module: 'product_deletion_requests', icon: 'delete_sweep', roles: ['admin', 'inventoryManager'] },
  { label: 'Kho tổng', path: '/inventory', module: 'inventory', icon: 'warehouse', roles: ['inventoryManager'] },
  { label: 'Phiếu nhập NCC', path: '/inventory/supplier-receipts', module: 'supplier_receipts', icon: 'assignment_turned_in', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers', module: 'supplier_receipts', icon: 'storefront', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Lô hàng nhập', path: '/inventory/batches', module: 'warehouse_batches', icon: 'inventory', roles: ['admin', 'agencyManager', 'inventoryManager', 'accountant'] },
  { label: 'Trả hàng nhập', path: '/inventory/returns', module: 'inventory_returns', icon: 'assignment_return', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Kiểm kê tồn kho', path: '/inventory/stocktake', module: 'inventory_stocktake', icon: 'fact_check', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Báo cáo kho', path: '/inventory/reports', module: 'inventory_reports', icon: 'analytics', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Lô sản xuất', path: '/inventory/production-orders', module: 'inventory', icon: 'precision_manufacturing', roles: ['inventoryManager'] },
  { label: 'Sổ kho', path: '/inventory/ledger', module: 'inventory_ledger', icon: 'fact_check', roles: ['admin', 'agencyManager', 'inventoryManager', 'accountant'] },
  { label: 'Định mức BOM', path: '/inventory/boms', module: 'inventory', icon: 'schema', roles: ['inventoryManager'] },
  { label: 'Đóng gói theo yêu cầu', path: '/inventory/custom-bundles', module: 'inventory', icon: 'package_2', roles: ['inventoryManager'] },
  {
    label: 'Thống kê kho',
    path: '/inventory/statistics',
    module: 'inventory_statistics',
    icon: 'analytics',
    roles: ['inventoryManager', 'accountant'],
    children: [
      { label: 'Tổng quan', path: '/inventory/statistics?section=overview', section: 'overview', sectionScope: 'inventory_statistics' },
      { label: 'Trạng thái hàng hoá', path: '/inventory/statistics?section=alerts', section: 'alerts', sectionScope: 'inventory_statistics' },
    ],
  },
  {
    label: 'Bổ sung tồn quầy',
    path: '/inventory/stock-requests',
    module: 'stock_adjustment_ops',
    icon: 'edit_note',
    roles: ['admin', 'agencyManager', 'inventoryManager'],
  },
  {
    label: 'Bảng giá vốn & giá bán',
    path: '/accounting/cost-profit',
    module: 'accounting_cost',
    icon: 'sell',
    roles: ['accountant', 'admin', 'agencyManager'],
  },
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
    label: 'Nhật ký hệ thống',
    path: '/admin/system-activities',
    module: 'system_activity_log',
    icon: 'manage_search',
    roles: ['admin'],
  },
  {
    label: 'Thống kê bán hàng',
    path: '/dashboard',
    module: 'dashboard',
    icon: 'dashboard',
    roles: ['admin', 'agencyManager', 'accountant', 'salesStaff'],
    children: DASHBOARD_SECTIONS.map((section) => ({
      label: section.label,
      path: buildDashboardPath(section.key),
      section: section.key,
      sectionScope: 'dashboard',
    })),
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

/**
 * Gom nhóm sidebar cho role Thủ kho: 3 nhóm cha có thể mở/gập.
 * Mỗi entry con trỏ tới path đã có trong navigationItems; `label` (nếu có) ghi đè nhãn hiển thị.
 */
const INVENTORY_SIDEBAR_GROUPS = [
  {
    key: '__grp_inventory_products',
    label: 'Hàng hóa',
    icon: 'inventory_2',
    entries: [
      { path: '/inventory/products', label: 'Sản phẩm & Số lượng' },
      { path: '/products/categories', label: 'Danh mục sản phẩm' },
      { path: '/inventory/boms' },
      { path: '/inventory/product-approvals', label: 'Lịch sử tạo hàng hóa' },
      { path: '/inventory/product-deletion-requests', label: 'Yêu cầu xóa hàng hóa' },
    ],
  },
  {
    key: '__grp_inventory_warehouse',
    label: 'Kho tổng',
    icon: 'warehouse',
    entries: [
      { path: '/inventory', label: 'Tồn kho tổng' },
      { path: '/inventory/returns' },
      { path: '/inventory/stocktake' },
      { path: '/inventory/ledger' },
      { path: '/inventory/stock-requests' },
      { path: '/inventory/suppliers' },
    ],
  },
  {
    key: '__grp_inventory_production',
    label: 'Sản xuất & đóng gói',
    icon: 'precision_manufacturing',
    entries: [
      { path: '/inventory/production-orders' },
      { path: '/inventory/custom-bundles' },
    ],
  },
]

function isInventoryOnlySession(roles = []) {
  if (!roles.length) return false
  return (
    hasAnyRoleGroup(roles, ['inventoryManager']) && !hasAnyRoleGroup(roles, ['admin', 'agencyManager'])
  )
}

/** Fold các mục kho phẳng thành 3 nhóm cha; giữ nguyên các mục còn lại theo thứ tự gốc. */
function groupInventorySidebar(items) {
  const byPath = new Map(items.map((item) => [item.path, item]))
  const consumed = new Set()

  const groups = INVENTORY_SIDEBAR_GROUPS.map((spec) => {
    const children = spec.entries
      .map(({ path, label }) => {
        const found = byPath.get(path)
        if (!found) return null
        consumed.add(path)
        return {
          label: label || found.label,
          path: found.path,
          module: found.module,
        }
      })
      .filter(Boolean)

    if (!children.length) return null

    return {
      label: spec.label,
      icon: spec.icon,
      path: spec.key,
      module: 'inventory',
      isGroup: true,
      children,
    }
  }).filter(Boolean)

  const rest = items.filter((item) => !consumed.has(item.path))
  return [...groups, ...rest]
}

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

export function getNavigationItemsForModules(modules = [], roles = []) {
  if (!modules.length && !roles.length) {
    return []
  }

  const allowedModules = new Set(
    modules.map((module) => module.toLowerCase()).filter(isSidebarModuleEnabled),
  )

  return navigationItems.filter((item) => {
    if (!isSidebarModuleEnabled(item.module)) return false

    const roleAllowed = !item.roles?.length || hasAnyRoleGroup(roles, item.roles)
    if (!roleAllowed) return false

    if (allowedModules.has(item.module)) return true
    if (roles.length && hasAnyRoleGroup(roles, item.roles)) return true

    return false
  })
}

export function getNavigationItemsForRoles(roles = []) {
  if (!roles.length) {
    return []
  }

  return navigationItems.filter((item) => hasAnyRoleGroup(roles, item.roles))
}

function withRoleAwareProductLabel(items, roles = []) {
  const isWarehouse = (roles ?? []).some((role) => {
    const normalized = String(role || '').toLowerCase().trim()
    return ['inventory manager', 'inventorymanager', 'warehouse manager', 'thu kho', 'thukho', 'warehouse'].includes(
      normalized,
    )
  })

  return items.map((item) =>
    item.path === '/inventory/products' && isWarehouse ? { ...item, label: 'Hàng hóa' } : item,
  )
}

export function getNavigationItemsForSession(session) {
  const roles = session?.roles ?? []
  const items = session?.modules?.length
    ? withRoleAwareProductLabel(getNavigationItemsForModules(session.modules, roles), roles)
    : withRoleAwareProductLabel(getNavigationItemsForRoles(roles), roles)

  return isInventoryOnlySession(roles) ? groupInventorySidebar(items) : items
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
    const first = items[0]
    if (!first) return '/profile'
    return first.isGroup ? first.children?.[0]?.path ?? '/profile' : first.path ?? '/profile'
  }

  return homeRoute
}

const MODULE_PATH_PREFIXES = [
  { module: 'accounting_cost', prefix: '/accounting' },
  { module: 'integrations', prefix: '/integrations' },
  { module: 'reports', prefix: '/reports' },
  { module: 'contracts', prefix: '/contracts' },
  { module: 'staff', prefix: '/staff' },
  { module: 'membership_tiers_admin', prefix: '/admin/membership-tiers' },
  { module: 'promotions_admin', prefix: '/admin/promotions' },
  { module: 'system_activity_log', prefix: '/admin/system-activities' },
  { module: 'users_admin', prefix: '/admin/users' },
  { module: 'phan_quyen_admin', prefix: '/admin/phan-quyen' },
  { module: 'customers', prefix: '/customers' },
  { module: 'product_creation_requests', prefix: '/inventory/product-approvals' },
  { module: 'product_deletion_requests', prefix: '/inventory/product-deletion-requests' },
  { module: 'products', prefix: '/products/categories' },
  { module: 'products', prefix: '/inventory/products' },
  { module: 'stock_adjustment_ops', prefix: '/inventory/stock-requests' },
  { module: 'supplier_receipts', prefix: '/inventory/supplier-receipts' },
  { module: 'supplier_receipts', prefix: '/inventory/suppliers' },
  { module: 'warehouse_batches', prefix: '/inventory/batches' },
  { module: 'inventory_returns', prefix: '/inventory/returns' },
  { module: 'inventory_stocktake', prefix: '/inventory/stocktake' },
  { module: 'inventory_reports', prefix: '/inventory/reports' },
  { module: 'inventory_ledger', prefix: '/inventory/ledger' },
  { module: 'inventory', prefix: '/inventory' },
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

  if (String(module).toLowerCase() === 'pos' && session?.permissions?.length) {
    return (
      session.permissions.includes('CREATE_POS_ORDER')
      || session.permissions.includes('CREATE_COD_ORDER')
    )
  }

  if (String(module).toLowerCase() === 'cod_ops' && session?.permissions?.length) {
    return (
      session.permissions.includes('CREATE_COD_ORDER')
      || session.permissions.includes('VERIFY_COD')
    )
  }

  if (String(module).toLowerCase() === 'orders' && session?.permissions?.length) {
    const canViewAll =
      session.permissions.includes('VIEW_ALL_CUSTOMERS')
      || session.permissions.includes('MANAGE_EMPLOYEE')
      || session.permissions.includes('MANAGE_ROLE')
    return session.permissions.includes('VIEW_ORDER')
      && (canViewAll || session.permissions.includes('CREATE_POS_ORDER'))
  }

  if (String(module).toLowerCase() === 'inventory') {
    if (!session?.roles?.length) return false
    return hasAnyRoleGroup(session.roles, ['inventoryManager', 'accountant'])
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

export function canAccessPath(session, pathname, search = '') {
  const path = (pathname || '').toLowerCase()
  const orderDetailContext = getOrderDetailContext(pathname, search)

  if (orderDetailContext === 'cod' && canAccessModule(session, 'cod_ops')) {
    return true
  }

  // SaleCod: được vào Trả/đổi + chi tiết liên quan (BE chỉ trả dữ liệu COD).
  if (isSaleCodOnlySession(session)) {
    if (
      path === '/orders/exchange'
      || path.startsWith('/orders/exchange/')
      || path === '/orders/returns'
      || path.startsWith('/orders/returns/')
      || orderDetailContext === 'exchange'
    ) {
      return true
    }
  }

  const module = getModuleForPath(pathname)
  return canAccessModule(session, module)
}

function isSaleCodOnlySession(session) {
  const permissions = session?.permissions ?? []
  const canViewAll =
    permissions.includes('VIEW_ALL_CUSTOMERS')
    || permissions.includes('MANAGE_EMPLOYEE')
    || permissions.includes('MANAGE_ROLE')
  return (
    !canViewAll
    && permissions.includes('CREATE_COD_ORDER')
    && !permissions.includes('CREATE_POS_ORDER')
  )
}

/** Xem danh sách / preview hàng chờ trừ tồn quầy (Manager/Admin). */
export function canViewStockDeductOps(session) {
  return canAccessModule(session, 'stock_deduct_ops')
}

/** Xác nhận trừ tồn quầy - chỉ Admin và Manager. */
export function canConfirmStockDeduct(session) {
  if (!session?.roles?.length) {
    return false
  }

  return hasAnyRoleGroup(session.roles, ['admin', 'agencyManager'])
}

export function getAccessDeniedMessage(pathname) {
  const module = getModuleForPath(pathname)
  if (module === 'pos') {
    return 'Tài khoản không có quyền tạo đơn POS/COD. Vui lòng đăng xuất và đăng nhập lại nếu quyền vừa được cập nhật.'
  }
  if (module === 'cod_ops') {
    return 'Chỉ Sale COD hoặc Quản lý chi nhánh mới được truy cập Quản lý COD.'
  }
  if (module === 'stock_deduct_ops') {
    return 'Chỉ Quản lý chi nhánh hoặc Admin mới được xử lý hàng chờ trừ tồn quầy.'
  }
  if (module === 'inventory') {
    return 'Chỉ Thủ kho Kho tổng mới được truy cập module kho tổng.'
  }
  if (module === 'promotions_admin' || module === 'membership_tiers_admin' || module === 'system_activity_log') {
    return 'Chỉ Admin mới được quản lý hạng thẻ và mã giảm giá.'
  }
  if (module === 'users_admin' || module === 'phan_quyen_admin') {
    return 'Chỉ Quản trị viên mới được quản lý tài khoản và phân quyền.'
  }
  return 'Bạn không có quyền truy cập trang này.'
}

const ORDER_LIST_SUBROUTES = new Set(['cod', 'exchange', 'stock-deduct', 'create'])

function getOrderDetailContext(pathname, search = '') {
  const path = (pathname || '').toLowerCase()
  const match = path.match(/^\/orders\/([^/]+)$/)
  if (!match || ORDER_LIST_SUBROUTES.has(match[1])) {
    return null
  }

  const params = new URLSearchParams(search || '')
  const from = (params.get('from') || '').toLowerCase()
  if (from === 'exchange' || from === 'cod') {
    return from
  }

  return 'sale'
}

/** Sidebar highlight: /orders/cod must not activate the /orders item. */
export function isNavigationItemActive(pathname, item, search = '') {
  const path = (pathname || '').toLowerCase()

  // Nhóm cha của role kho: active khi bất kỳ mục con nào đang active (theo path).
  if (item?.isGroup) {
    return (item.children || []).some((child) =>
      isNavigationItemActive(pathname, { path: child.path, module: child.module }, search),
    )
  }

  const target = (item?.path || '').toLowerCase()
  const orderDetailContext = getOrderDetailContext(pathname, search)

  if (!target) {
    return false
  }

  if (item.module === 'cod_ops') {
    return path === target || path.startsWith(`${target}/`) || orderDetailContext === 'cod'
  }

  if (item.module === 'stock_deduct_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'stock_adjustment_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'inventory') {
    if (path === '/inventory/stock-requests' || path.startsWith('/inventory/stock-requests/')) {
      return false
    }
    if (path === '/inventory/products' || path.startsWith('/inventory/products/')) {
      return false
    }
    if (target === '/inventory') {
      return path === target
    }
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'inventory_statistics') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'products') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'orders') {
    if (target === '/orders/exchange') {
      return (
        path === '/orders/exchange'
        || path.startsWith('/orders/exchange/')
        || path === '/orders/returns'
        || path.startsWith('/orders/returns/')
        || orderDetailContext === 'exchange'
      )
    }
    if (path === '/orders/cod' || path.startsWith('/orders/cod/')) {
      return false
    }
    if (path === '/orders/exchange') {
      return false
    }
    if (path === '/orders/returns' || path.startsWith('/orders/returns/')) {
      return false
    }
    if (orderDetailContext === 'exchange') {
      return false
    }
    if (orderDetailContext === 'cod') {
      return false
    }
    if (path === '/orders/stock-deduct' || path.startsWith('/orders/stock-deduct/')) {
      return false
    }
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'customers') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'dashboard') {
    return path === target || path.startsWith(`${target}/`)
  }

  return path === target || path.startsWith(`${target}/`)
}

export function isNavigationChildActive(pathname, search, child) {
  // Nhóm cha của role kho: mục con điều hướng theo path riêng (không có section).
  if (child && !child.section && child.path) {
    return isNavigationItemActive(pathname, { path: child.path, module: child.module }, search)
  }

  if (!child?.section) {
    return false
  }

  const path = (pathname || '').toLowerCase()
  const scope = child.sectionScope || 'dashboard'

  if (scope === 'customers') {
    if (path !== '/customers') {
      return false
    }

    return getCustomerSectionFromSearch(search) === child.section
  }

  if (scope === 'inventory_statistics') {
    if (path !== '/inventory/statistics') {
      return false
    }
    const params = new URLSearchParams(search)
    const section = params.get('section') || 'overview'
    return section === child.section
  }

  if (path !== '/dashboard') {
    return false
  }

  return getDashboardSectionFromSearch(search) === child.section
}
