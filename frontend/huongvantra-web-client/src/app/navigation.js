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

/** Tạm ẩn trên sidebar — bật lại khi backend sẵn sàng / khi đã tách rõ với kiểm kê. */
const SIDEBAR_DISABLED_MODULES = new Set([
  'reports',
  'integrations',
  'contracts',
  'inventory_reports',
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
  { label: 'Quỹ ca POS', path: '/pos/cash-sessions', module: 'orders', icon: 'account_balance_wallet', roles: ['agencyManager', 'accountant'] },
  {
    label: 'Đơn hàng',
    path: '/orders',
    module: 'orders',
    icon: 'receipt_long',
    roles: ['admin', 'agencyManager', 'salePos', 'saleCod', 'accountant'],
    children: [
      {
        label: 'Quản Lý Đơn POS',
        path: '/orders',
        module: 'orders',
        roles: ['admin', 'agencyManager', 'salePos', 'accountant'],
      },
      {
        label: 'Quản Lý Đơn COD',
        path: '/orders/cod',
        module: 'cod_ops',
        roles: ['admin', 'agencyManager', 'saleCod'],
      },
    ],
  },
  { label: 'Trả / đổi hàng', path: '/orders/exchange', module: 'orders', icon: 'swap_horiz', roles: ['admin', 'agencyManager', 'salePos', 'saleCod', 'accountant'] },
  {
    label: 'Chờ đóng gói / trừ Kho',
    path: '/orders/stock-deduct',
    module: 'stock_deduct_ops',
    icon: 'inventory_2',
    roles: ['agencyManager', 'inventoryManager'],
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
  { label: 'Lịch sử tạo hàng hóa', path: '/inventory/product-approvals', module: 'product_creation_requests', icon: 'verified', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Yêu cầu xóa hàng hóa', path: '/inventory/product-deletion-requests', module: 'product_deletion_requests', icon: 'delete_sweep', roles: ['agencyManager', 'inventoryManager'] },
  { label: 'Kho', path: '/inventory', module: 'inventory', icon: 'warehouse', roles: ['inventoryManager'] },
  { label: 'Phiếu nhập nhà cung cấp', path: '/inventory/supplier-receipts', module: 'supplier_receipts', icon: 'assignment_turned_in', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers', module: 'supplier_receipts', icon: 'storefront', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Lô hàng nhập', path: '/inventory/batches', module: 'warehouse_batches', icon: 'inventory', roles: ['admin', 'agencyManager', 'inventoryManager', 'accountant'] },
  { label: 'Trả hàng nhập', path: '/inventory/returns', module: 'inventory_returns', icon: 'assignment_return', roles: ['agencyManager', 'inventoryManager'] },
  { label: 'Kiểm kê tồn kho', path: '/inventory/stocktake', module: 'inventory_stocktake', icon: 'fact_check', roles: ['admin', 'agencyManager', 'inventoryManager', 'salesStaff'] },
  { label: 'Báo cáo kho', path: '/inventory/reports', module: 'inventory_reports', icon: 'analytics', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Quản lý lệnh sản xuất', path: '/inventory/production-orders', module: 'production_orders', icon: 'precision_manufacturing', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Nhật ký kho', path: '/inventory/ledger', module: 'inventory_ledger', icon: 'fact_check', roles: ['admin', 'agencyManager', 'inventoryManager', 'accountant'] },
  { label: 'Định mức BOM', path: '/inventory/boms', module: 'inventory', icon: 'schema', roles: ['inventoryManager'] },
  { label: 'Đóng gói theo yêu cầu', path: '/inventory/custom-bundles', module: 'inventory', icon: 'package_2', roles: ['inventoryManager'] },
  {
    label: 'Thống kê trong kho',
    path: '/inventory/statistics',
    module: 'inventory_statistics',
    icon: 'analytics',
    roles: ['inventoryManager', 'accountant', 'agencyManager'],
    children: [
      { label: 'Tổng quan', path: '/inventory/statistics?section=overview', section: 'overview', sectionScope: 'inventory_statistics' },
      { label: 'Trạng thái hàng hoá', path: '/inventory/statistics?section=alerts', section: 'alerts', sectionScope: 'inventory_statistics' },
    ],
  },
  {
    label: 'Yêu cầu bổ sung tồn quầy',
    path: '/inventory/stock-requests',
    module: 'stock_adjustment_ops',
    icon: 'edit_note',
    roles: ['agencyManager', 'inventoryManager'],
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
    label: 'Lịch làm việc',
    path: '/shifts',
    module: 'shift_manage',
    icon: 'calendar_month',
    // Chỉ Manager — chỉ định / gỡ Sale khỏi ca (mọi ngày trong tuần hiện tại).
    roles: ['agencyManager'],
  },
  {
    label: 'Lịch làm việc của tôi',
    path: '/my-shifts',
    module: 'my_shifts',
    icon: 'schedule',
    // Sale xem lịch ca (của mình + đồng nghiệp) / đăng ký khi Manager mở cửa sổ.
    roles: ['salesStaff'],
  },
  {
    label: 'Hạng khách hàng',
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
    label: 'Đồng bộ tồn kho',
    path: '/admin/inventory-sync',
    module: 'inventory_sync_monitor',
    icon: 'sync_problem',
    roles: ['agencyManager'],
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
      { path: '/inventory', label: 'Kho' },
      { path: '/inventory/batches', label: 'Lô hàng nhập' },
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

function isAdminSession(roles = []) {
  return hasAnyRoleGroup(roles, ['admin'])
}

function isAgencyManagerSession(roles = []) {
  return hasAnyRoleGroup(roles, ['agencyManager'])
}

function takeNavLeaf(byPath, consumed, path, label) {
  const found = byPath.get(path)
  if (!found) return null
  consumed.add(path)
  return {
    label: label || found.label,
    path: found.path,
    module: found.module,
    section: found.section,
    sectionScope: found.sectionScope,
  }
}

function takeNavLeaves(byPath, consumed, entries) {
  return entries
    .map(([path, label]) => takeNavLeaf(byPath, consumed, path, label))
    .filter(Boolean)
}

/**
 * Gom sidebar Admin / Manager thành dropdown cha → con (theo phân tích menu).
 * Admin gọn hơn: không POS, không chờ xử lý / bổ sung tồn / đồng bộ / phân ca.
 */
function groupAdminManagerSidebar(items, isAdmin) {
  const byPath = new Map(items.map((item) => [item.path, item]))
  const consumed = new Set()
  const result = []

  // POS — Manager luôn được dùng (inject nếu bị lọc modules)
  if (!isAdmin) {
    const posItem = byPath.get('/pos') || navigationItems.find((item) => item.path === '/pos')
    if (posItem) {
      consumed.add('/pos')
      result.push({
        label: posItem.label,
        path: posItem.path,
        module: posItem.module,
        icon: posItem.icon,
        roles: posItem.roles,
      })
    }
  } else if (byPath.has('/pos')) {
    consumed.add('/pos')
  }

  // Đơn hàng
  const orderChildren = []
  const ordersItem = byPath.get('/orders')
  if (ordersItem) {
    consumed.add('/orders')
    for (const child of ordersItem.children || []) {
      orderChildren.push({
        label: child.label,
        path: child.path,
        module: child.module,
        roles: child.roles,
      })
    }
  }
  const exchange = takeNavLeaf(byPath, consumed, '/orders/exchange', 'Trả / đổi hàng')
  if (exchange) orderChildren.push(exchange)

  if (!isAdmin) {
    const waiting = takeNavLeaf(byPath, consumed, '/orders/stock-deduct', 'Chờ đóng gói / trừ Kho')
    if (waiting) orderChildren.push(waiting)
  } else if (byPath.has('/orders/stock-deduct')) {
    consumed.add('/orders/stock-deduct')
  }

  if (orderChildren.length) {
    result.push({
      label: 'Đơn hàng',
      icon: 'receipt_long',
      path: '__grp_orders',
      module: 'orders',
      isGroup: true,
      children: orderChildren,
    })
  }

  // Khách hàng — Admin xem/theo dõi; Manager / Sale / Kế toán vận hành
  const customers = byPath.get('/customers')
  if (customers) {
    consumed.add('/customers')
    result.push(customers)
  }

  // Hàng hóa
  const goodsEntries = isAdmin
    ? [
        ['/inventory/products', 'Sản phẩm & số lượng'],
        ['/products/categories', 'Danh mục sản phẩm'],
        ['/accounting/cost-profit', 'Bảng giá vốn & giá bán'],
        ['/inventory/product-approvals', 'Lịch sử tạo hàng hóa'],
        ['/inventory/stocktake', 'Kiểm kê tồn kho'],
        ['/inventory/ledger', 'Nhật ký kho'],
      ]
    : [
        ['/inventory/products', 'Sản phẩm & số lượng'],
        ['/products/categories', 'Danh mục sản phẩm'],
        ['/accounting/cost-profit', 'Bảng giá vốn & giá bán'],
        ['/inventory/product-approvals', 'Lịch sử tạo hàng hóa'],
        ['/inventory/product-deletion-requests', 'Yêu cầu xóa hàng hóa'],
        ['/inventory/stocktake', 'Kiểm kê tồn kho'],
        ['/inventory/ledger', 'Nhật ký kho'],
        ['/inventory/stock-requests', 'Yêu cầu bổ sung tồn quầy'],
        ['/admin/inventory-sync', 'Đồng bộ tồn kho'],
      ]

  if (isAdmin) {
    for (const path of ['/inventory/statistics', '/inventory/stock-requests', '/admin/inventory-sync', '/inventory/returns']) {
      if (byPath.has(path)) consumed.add(path)
    }
  }

  const goodsChildren = takeNavLeaves(byPath, consumed, goodsEntries)

  if (!isAdmin) {
    const statsItem = byPath.get('/inventory/statistics')
    if (statsItem) {
      consumed.add('/inventory/statistics')
      const overview =
        statsItem.children?.find((child) => child.section === 'overview') ||
        statsItem.children?.[0]
      const overviewLeaf = {
        label: 'Tổng quan tồn kho',
        path: overview?.path || '/inventory/statistics?section=overview',
        module: statsItem.module,
        section: overview?.section || 'overview',
        sectionScope: overview?.sectionScope || 'inventory_statistics',
      }
      const priceIdx = goodsChildren.findIndex((child) => child.path === '/accounting/cost-profit')
      goodsChildren.splice(priceIdx >= 0 ? priceIdx + 1 : goodsChildren.length, 0, overviewLeaf)
    }
  }

  if (goodsChildren.length) {
    result.push({
      label: 'Hàng hóa',
      icon: 'inventory_2',
      path: '__grp_goods',
      module: 'products',
      isGroup: true,
      children: goodsChildren,
    })
  }

  // Nhập hàng & Nhà cung cấp
  const inboundEntries = isAdmin
    ? [
        ['/inventory/suppliers', 'Nhà cung cấp'],
        ['/inventory/supplier-receipts', 'Phiếu nhập nhà cung cấp'],
        ['/inventory/batches', 'Lô hàng nhập'],
        ['/inventory/production-orders', 'Quản lý lệnh sản xuất'],
      ]
    : [
        ['/inventory/suppliers', 'Nhà cung cấp'],
        ['/inventory/supplier-receipts', 'Phiếu nhập nhà cung cấp'],
        ['/inventory/batches', 'Lô hàng nhập'],
        ['/inventory/production-orders', 'Quản lý lệnh sản xuất'],
        ['/inventory/returns', 'Trả hàng nhập'],
      ]
  const inboundChildren = takeNavLeaves(byPath, consumed, inboundEntries)
  if (inboundChildren.length) {
    result.push({
      label: 'Nhập hàng & Nhà cung cấp',
      icon: 'storefront',
      path: '__grp_inbound',
      module: 'supplier_receipts',
      isGroup: true,
      children: inboundChildren,
    })
  }

  // Nhân sự & Vận hành
  const peopleEntries = isAdmin
    ? [['/staff', 'Nhân sự']]
    : [
        ['/shifts', 'Lịch làm việc'],
        ['/staff', 'Nhân sự'],
        ['/pos/cash-sessions', 'Quỹ ca POS'],
      ]
  if (isAdmin) {
    if (byPath.has('/shifts')) consumed.add('/shifts')
    if (byPath.has('/pos/cash-sessions')) consumed.add('/pos/cash-sessions')
  }
  const peopleChildren = takeNavLeaves(byPath, consumed, peopleEntries)
  if (peopleChildren.length) {
    result.push({
      label: 'Nhân sự & Vận hành',
      icon: 'badge',
      path: '__grp_people',
      module: 'staff',
      isGroup: true,
      children: peopleChildren,
    })
  }

  // Hệ thống — chỉ Admin
  if (isAdmin) {
    const systemChildren = takeNavLeaves(byPath, consumed, [
      ['/admin/system-activities', 'Nhật ký hệ thống'],
      ['/admin/users', 'Tài khoản'],
      ['/admin/phan-quyen', 'Phân quyền'],
      ['/admin/membership-tiers', 'Hạng khách hàng'],
      ['/admin/promotions', 'Mã giảm giá'],
    ])
    if (systemChildren.length) {
      result.push({
        label: 'Hệ thống',
        icon: 'settings',
        path: '__grp_system',
        module: 'users_admin',
        isGroup: true,
        children: systemChildren,
      })
    }
  }

  // Thống kê bán hàng — Admin đưa lên đầu sidebar
  const dashboard = byPath.get('/dashboard')
  if (dashboard) {
    consumed.add('/dashboard')
    if (isAdmin) {
      result.unshift(dashboard)
    } else {
      result.push(dashboard)
    }
  }

  const rest = items.filter((item) => !consumed.has(item.path))
  return [...result, ...rest]
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

function filterModuleChildren(children = [], allowedModules, roles = []) {
  return children.filter((child) => {
    if (!child.module) return true
    if (!isSidebarModuleEnabled(child.module)) return false
    if (child.roles?.length && !hasAnyRoleGroup(roles, child.roles)) return false
    if (allowedModules.has(child.module)) return true
    if (roles.length && child.roles?.length && hasAnyRoleGroup(roles, child.roles)) return true
    return false
  })
}

function filterRoleChildren(children = [], roles = []) {
  return children.filter((child) => {
    if (!child.module && !child.roles?.length) return true
    if (child.roles?.length) return hasAnyRoleGroup(roles, child.roles)
    return true
  })
}

export function getNavigationItemsForModules(modules = [], roles = []) {
  if (!modules.length && !roles.length) {
    return []
  }

  const allowedModules = new Set(
    modules.map((module) => module.toLowerCase()).filter(isSidebarModuleEnabled),
  )

  return navigationItems
    .map((item) => {
      if (!isSidebarModuleEnabled(item.module)) return null

      const roleAllowed = !item.roles?.length || hasAnyRoleGroup(roles, item.roles)
      if (!roleAllowed) return null

      const hasModuleChildren = item.children?.some((child) => child.module)
      if (hasModuleChildren) {
        const children = filterModuleChildren(item.children, allowedModules, roles)
        if (!children.length) return null
        return { ...item, children, path: children[0].path || item.path }
      }

      if (allowedModules.has(item.module)) return item
      if (roles.length && hasAnyRoleGroup(roles, item.roles)) return item
      return null
    })
    .filter(Boolean)
}

export function getNavigationItemsForRoles(roles = []) {
  if (!roles.length) {
    return []
  }

  return navigationItems
    .map((item) => {
      if (!isSidebarModuleEnabled(item.module)) return null
      if (!hasAnyRoleGroup(roles, item.roles)) return null

      const hasModuleChildren = item.children?.some((child) => child.module || child.roles?.length)
      if (hasModuleChildren) {
        const children = filterRoleChildren(item.children, roles)
        if (!children.length) return null
        return { ...item, children, path: children[0].path || item.path }
      }

      return item
    })
    .filter(Boolean)
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

  if (isInventoryOnlySession(roles)) {
    return groupInventorySidebar(items)
  }

  if (isAdminSession(roles) || isAgencyManagerSession(roles)) {
    return groupAdminManagerSidebar(items, isAdminSession(roles))
  }

  return items
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

    const item =
      navigationItems.find((entry) => entry.module === module)
      || navigationItems
        .flatMap((entry) => entry.children || [])
        .find((child) => child.module === module)
    if (item?.path) {
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

  // Admin luôn vào trang thống kê bán hàng để giám sát.
  if (isAdminSession(authSession.roles ?? []) || hasPermissionManageRole(authSession)) {
    return '/dashboard'
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

function hasPermissionManageRole(authSession) {
  return (authSession?.permissions ?? []).includes('MANAGE_ROLE')
}

const MODULE_PATH_PREFIXES = [
  { module: 'accounting_cost', prefix: '/accounting' },
  { module: 'integrations', prefix: '/integrations' },
  { module: 'reports', prefix: '/reports' },
  { module: 'contracts', prefix: '/contracts' },
  { module: 'shift_manage', prefix: '/shifts' },
  { module: 'my_shifts', prefix: '/my-shifts' },
  { module: 'staff', prefix: '/staff' },
  { module: 'membership_tiers_admin', prefix: '/admin/membership-tiers' },
  { module: 'promotions_admin', prefix: '/admin/promotions' },
  { module: 'system_activity_log', prefix: '/admin/system-activities' },
  { module: 'inventory_sync_monitor', prefix: '/admin/inventory-sync' },
  { module: 'users_admin', prefix: '/admin/users' },
  { module: 'phan_quyen_admin', prefix: '/admin/phan-quyen' },
  { module: 'customers', prefix: '/customers' },
  { module: 'product_creation_requests', prefix: '/inventory/product-approvals' },
  { module: 'product_deletion_requests', prefix: '/inventory/product-deletion-requests' },
  { module: 'products', prefix: '/products/categories' },
  { module: 'products', prefix: '/inventory/products' },
  { module: 'stock_adjustment_ops', prefix: '/inventory/stock-requests' },
  { module: 'supplier_receipt_create', prefix: '/inventory/import/create' },
  { module: 'supplier_receipts', prefix: '/inventory/supplier-receipts' },
  { module: 'supplier_receipts', prefix: '/inventory/suppliers' },
  { module: 'warehouse_batches', prefix: '/inventory/batches' },
  { module: 'inventory_returns', prefix: '/inventory/return-inspections' },
  { module: 'inventory_returns', prefix: '/inventory/returns' },
  { module: 'inventory_stocktake', prefix: '/inventory/stocktake' },
  { module: 'production_orders', prefix: '/inventory/production-orders' },
  { module: 'inventory_reports', prefix: '/inventory/reports' },
  { module: 'inventory_ledger', prefix: '/inventory/ledger' },
  { module: 'inventory', prefix: '/inventory' },
  { module: 'cod_ops', prefix: '/orders/cod' },
  { module: 'stock_deduct_ops', prefix: '/orders/stock-deduct' },
  { module: 'orders', prefix: '/orders' },
  { module: 'orders', prefix: '/pos/cash-sessions' },
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
      // Manager (MANAGE_EMPLOYEE) luôn được vào POS bán hàng
      || session.permissions.includes('MANAGE_EMPLOYEE')
    )
  }

  if (String(module).toLowerCase() === 'cod_ops' && session?.permissions?.length) {
    return (
      session.permissions.includes('CREATE_COD_ORDER')
      || session.permissions.includes('VERIFY_COD')
      // Admin / Manager: xem & theo dõi COD, không cần quyền tạo/thu.
      || session.permissions.includes('MANAGE_EMPLOYEE')
      || session.permissions.includes('MANAGE_ROLE')
      || session.permissions.includes('VIEW_ALL_CUSTOMERS')
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

  if (String(module).toLowerCase() === 'supplier_receipt_create') {
    if (!session?.roles?.length) return false
    return (
      hasAnyRoleGroup(session.roles, ['inventoryManager'])
      && !hasAnyRoleGroup(session.roles, ['admin'])
    )
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

/** Xem danh sách / preview Queue đóng gói - Warehouse, Manager, Admin. */
export function canViewStockDeductOps(session) {
  return canAccessModule(session, 'stock_deduct_ops')
}

/** Xác nhận Queue đóng gói / trừ Kho - chỉ Warehouse. */
export function canConfirmStockDeduct(session) {
  if (!session?.roles?.length) {
    return false
  }

  return (
    hasAnyRoleGroup(session.roles, ['inventoryManager'])
    && !hasAnyRoleGroup(session.roles, ['admin'])
  )
}

/** Hủy Queue là xử lý ngoại lệ/escalation của Manager. */
export function canCancelStockDeduct(session) {
  if (!session?.roles?.length) {
    return false
  }

  return hasAnyRoleGroup(session.roles, ['agencyManager'])
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
    return 'Chỉ Thủ kho xác nhận đóng gói/trừ Kho; Quản lý xử lý ngoại lệ (hủy queue).'
  }
  if (module === 'supplier_receipt_create') {
    return 'Chỉ Thủ kho được tạo hoặc gửi Phiếu nhập nhà cung cấp.'
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

  // Nhóm cha của role kho / nhóm Đơn hàng: active khi bất kỳ mục con nào đang active.
  if (item?.isGroup || item?.children?.some((child) => child.module)) {
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

  // POS bán hàng: không highlight khi đang ở Quỹ ca POS (/pos/cash-sessions).
  if (item.module === 'pos' || target === '/pos') {
    if (path === '/pos/cash-sessions' || path.startsWith('/pos/cash-sessions/')) {
      return false
    }
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
