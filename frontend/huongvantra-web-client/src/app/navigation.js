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
  'integrations',
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
  'stock_transfer_ops',
  'supplier_receipts',
  'inventory_returns',
  'inventory_ledger',
  'inventory',
  'staff',
]

// --- Tạm ẩn (chưa xử lý backend) ---
// { label: 'Sản phẩm', path: '/products', module: 'products', roles: ['admin', 'agencyManager', 'inventoryManager'] },
// { label: 'Tích hợp', path: '/integrations', module: 'integrations', roles: ['admin'] },

export const navigationItems = [
  { label: 'POS bán hàng', path: '/pos', module: 'pos', icon: 'point_of_sale', roles: ['agencyManager', 'salesStaff', 'customer'] },
  { label: 'Quỹ ca POS', path: '/pos/cash-sessions', module: 'orders', icon: 'account_balance_wallet', roles: ['agencyManager'] },
  {
    label: 'Đơn hàng',
    path: '/orders',
    module: 'orders',
    icon: 'receipt_long',
    roles: ['admin', 'agencyManager', 'salePos', 'saleCod', 'accountant'],
    children: [
      {
        label: 'Bán theo hợp đồng',
        path: '/orders/create',
        module: 'orders',
        roles: ['admin', 'agencyManager', 'accountant'],
      },
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
  { label: 'Hợp đồng', path: '/contracts', module: 'contracts', icon: 'description', roles: ['admin', 'agencyManager', 'accountant'] },
  { label: 'Sản phẩm & Số lượng', path: '/inventory/products', module: 'products', icon: 'inventory_2', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Danh Mục Sản Phẩm', path: '/products/categories', module: 'products', icon: 'category', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Lịch sử tạo hàng hóa', path: '/inventory/product-approvals', module: 'product_creation_requests', icon: 'verified', roles: ['admin', 'agencyManager', 'inventoryManager'] },
  { label: 'Kho', path: '/inventory', module: 'inventory', icon: 'warehouse', roles: ['inventoryManager'] },
  { label: 'Phiếu nhập nhà cung cấp', path: '/inventory/supplier-receipts', module: 'supplier_receipts', icon: 'assignment_turned_in', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers', module: 'supplier_receipts', icon: 'storefront', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Sản phẩm theo nhà cung cấp', path: '/inventory/supplier-products', module: 'supplier_receipts', icon: 'inventory_2', roles: ['admin', 'agencyManager', 'accountant', 'inventoryManager'] },
  { label: 'Lô hàng nhập', path: '/inventory/batches', module: 'warehouse_batches', icon: 'inventory', roles: ['admin', 'agencyManager', 'inventoryManager', 'accountant'] },
  { label: 'Trả hàng nhập', path: '/inventory/returns', module: 'inventory_returns', icon: 'assignment_return', roles: ['agencyManager', 'inventoryManager'] },
  { label: 'Kiểm kê tồn kho', path: '/inventory/stocktake', module: 'inventory_stocktake', icon: 'fact_check', roles: ['admin', 'agencyManager', 'inventoryManager'] },
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
    roles: ['inventoryManager', 'accountant', 'admin', 'agencyManager'],
    children: [
      {
        label: 'Tổng quan',
        path: '/inventory/statistics?section=overview',
        section: 'overview',
        sectionScope: 'inventory_statistics',
        roles: ['inventoryManager', 'accountant'],
      },
      {
        label: 'Trạng thái hàng hoá',
        path: '/inventory/statistics?section=alerts',
        section: 'alerts',
        sectionScope: 'inventory_statistics',
        roles: ['inventoryManager', 'accountant'],
      },
      {
        label: 'Báo cáo cuối ngày',
        path: '/inventory/warehouse-daily-report',
        module: 'warehouse_daily_report',
        roles: ['inventoryManager'],
      },
      {
        label: 'Báo cáo đã gửi',
        path: '/inventory/warehouse-daily-report/submissions',
        module: 'warehouse_daily_report',
        roles: ['inventoryManager', 'admin', 'agencyManager'],
      },
    ],
  },
  {
    label: 'Yêu cầu bổ sung Kệ Hàng',
    path: '/inventory/stock-requests',
    module: 'stock_adjustment_ops',
    icon: 'edit_note',
    roles: ['admin', 'agencyManager', 'inventoryManager'],
  },
  {
    label: 'Phiếu điều chuyển Kho → Kệ',
    path: '/inventory/stock-transfers',
    module: 'stock_transfer_ops',
    icon: 'move_down',
    roles: ['admin', 'agencyManager', 'inventoryManager'],
  },
  {
    label: 'Gợi ý bổ sung Kệ Hàng',
    path: '/inventory/shelf-replenishment-suggestions',
    module: 'stock_transfer_ops',
    icon: 'lightbulb',
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
    label: 'Đồng bộ Outbox',
    path: '/admin/inventory-sync',
    module: 'inventory_sync_monitor',
    icon: 'sync_alt',
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
    label: 'Báo cáo',
    path: '/reports/end-of-day',
    module: 'reports',
    icon: 'description',
    roles: ['admin', 'agencyManager', 'accountant'],
    children: [
      {
        label: 'Báo cáo cuối ngày',
        path: '/reports/end-of-day',
        module: 'reports',
        // Sale POS/COD chỉ dùng «Báo cáo chốt ca» trên POS; màn hình đầy đủ dành Manager/Kế toán.
        roles: ['admin', 'agencyManager', 'accountant'],
      },
    ],
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
      { path: '/inventory/stocktake', label: 'Kiểm kê tồn kho' },
      { path: '/inventory/ledger' },
      { path: '/inventory/stock-transfers', label: 'Điều chuyển Kho → Kệ' },
    ],
  },
  {
    key: '__grp_inventory_inbound',
    label: 'Nhập hàng & Nhà cung cấp',
    icon: 'storefront',
    entries: [
      { path: '/inventory/supplier-receipts', label: 'Phiếu nhập nhà cung cấp' },
      { path: '/inventory/suppliers', label: 'Nhà cung cấp' },
      { path: '/inventory/supplier-products', label: 'Sản phẩm theo nhà cung cấp' },
    ],
  },
  {
    key: '__grp_inventory_production',
    label: 'Sản xuất & đóng gói',
    icon: 'precision_manufacturing',
    entries: [
      { path: '/inventory/production-orders' },
      { path: '/inventory/custom-bundles' },
      { path: '/orders/stock-deduct', label: 'Chờ đóng gói / trừ Kho' },
    ],
  },
]

/**
 * Thủ kho vào hai màn hình này bằng nút trong trang Điều chuyển Kho → Kệ,
 * nên không lặp lại trên sidebar.
 */
const INVENTORY_SIDEBAR_HIDDEN_PATHS = new Set([
  '/inventory/stock-requests',
  '/inventory/shelf-replenishment-suggestions',
])

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

  const rest = items.filter(
    (item) => !consumed.has(item.path) && !INVENTORY_SIDEBAR_HIDDEN_PATHS.has(item.path),
  )
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
    const cashSessions = takeNavLeaf(byPath, consumed, '/pos/cash-sessions', 'Quỹ ca POS')
      || (() => {
        const fallback = navigationItems.find((item) => item.path === '/pos/cash-sessions')
        if (!fallback) return null
        consumed.add('/pos/cash-sessions')
        return {
          label: 'Quỹ ca POS',
          path: fallback.path,
          module: fallback.module,
          icon: fallback.icon,
          roles: fallback.roles,
        }
      })()
    if (cashSessions) {
      result.push({
        ...cashSessions,
        icon: cashSessions.icon || 'account_balance_wallet',
      })
    }
  } else if (byPath.has('/pos')) {
    consumed.add('/pos')
  }
  if (isAdmin && byPath.has('/pos/cash-sessions')) {
    consumed.add('/pos/cash-sessions')
  }

  // Đơn hàng — parent path có thể bị rewrite thành child path đầu tiên (/orders/create).
  const orderChildren = []
  // Path của mục cha bị ghi đè bằng path child đầu tiên khi lọc theo module/role,
  // nên phải dò thêm theo module thay vì chỉ tra '/orders'.
  const ordersItem = byPath.get('/orders')
    || items.find((item) => item.module === 'orders' && item.children?.length)
  if (ordersItem) {
    consumed.add(ordersItem.path)
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
  // Manager: luôn có Lịch sử tạo hàng hóa để duyệt (inject nếu bị lọc modules cũ).
  if (!isAdmin && !byPath.has('/inventory/product-approvals')) {
    const approvalsItem = navigationItems.find((item) => item.path === '/inventory/product-approvals')
    if (approvalsItem) byPath.set(approvalsItem.path, approvalsItem)
  }

  const goodsEntries = isAdmin
    ? [
      ['/inventory/products', 'Sản phẩm & số lượng'],
      ['/products/categories', 'Danh mục sản phẩm'],
      ['/accounting/cost-profit', 'Bảng giá vốn & giá bán'],
      ['/inventory/product-approvals', 'Lịch sử tạo hàng hóa'],
      ['/inventory/stocktake', 'Kiểm kê kệ hàng'],
      ['/inventory/ledger', 'Nhật ký kho'],
      ['/inventory/stock-transfers', 'Phiếu điều chuyển Kho → Kệ'],
      ['/inventory/shelf-replenishment-suggestions', 'Gợi ý bổ sung Kệ Hàng'],
    ]
    : [
      ['/inventory/products', 'Sản phẩm & số lượng'],
      ['/products/categories', 'Danh mục sản phẩm'],
      ['/accounting/cost-profit', 'Bảng giá vốn & giá bán'],
      ['/inventory/product-approvals', 'Lịch sử tạo hàng hóa'],
      ['/inventory/stocktake', 'Kiểm kê kệ hàng'],
      ['/inventory/ledger', 'Nhật ký kho'],
      ['/inventory/stock-requests', 'Yêu cầu bổ sung Kệ Hàng'],
    ]

  // Manager: ẩn thống kê tồn kho (không hiện ở nhóm Hàng hóa).
  // Lịch sử tạo hàng hóa hiện cho Manager để duyệt.
  // Trước khi consume statistics: giữ mục Báo cáo đã gửi cho Admin/Manager giám sát.
  const statsItem = byPath.get('/inventory/statistics')
  const submissionsNav = statsItem?.children?.find((child) =>
    String(child.path || '').includes('/warehouse-daily-report/submissions'))
  if (submissionsNav) {
    result.push({
      label: submissionsNav.label || 'Báo cáo đã gửi',
      path: submissionsNav.path,
      module: submissionsNav.module || 'warehouse_daily_report',
      icon: 'assignment_turned_in',
      roles: submissionsNav.roles,
    })
  }

  for (const path of [
    '/inventory/statistics',
  ]) {
    if (!isAdmin && byPath.has(path)) consumed.add(path)
  }

  // Manager vào hai màn hình này bằng nút trong trang Yêu cầu bổ sung Kệ Hàng.
  for (const path of ['/inventory/stock-transfers', '/inventory/shelf-replenishment-suggestions']) {
    if (!isAdmin && byPath.has(path)) consumed.add(path)
  }

  if (isAdmin) {
    for (const path of ['/inventory/statistics', '/inventory/stock-requests', '/inventory/returns']) {
      if (byPath.has(path)) consumed.add(path)
    }
  }

  const goodsChildren = takeNavLeaves(byPath, consumed, goodsEntries)

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
      ['/inventory/supplier-products', 'Sản phẩm theo nhà cung cấp'],
      ['/inventory/supplier-receipts', 'Phiếu nhập nhà cung cấp'],
      ['/inventory/batches', 'Lô hàng nhập'],
      ['/inventory/production-orders', 'Quản lý lệnh sản xuất'],
    ]
    : [
      ['/inventory/suppliers', 'Nhà cung cấp'],
      ['/inventory/supplier-products', 'Sản phẩm theo nhà cung cấp'],
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
      ['/staff', 'Nhân sự'],
      ['/shifts', 'Lịch làm việc'],
    ]
  if (isAdmin) {
    if (byPath.has('/shifts')) consumed.add('/shifts')
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
      ['/admin/users', 'Tài khoản'],
      ['/admin/phan-quyen', 'Phân quyền'],
      ['/admin/membership-tiers', 'Hạng khách hàng'],
      ['/admin/promotions', 'Mã giảm giá'],
      ['/admin/system-activities', 'Nhật ký hệ thống'],
      ['/admin/inventory-sync', 'Đồng bộ Outbox'],
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

  // Thống kê & Báo cáo — gom một nhóm (Admin: đẩy lên đầu sidebar)
  const insightsChildren = []

  const dashboardLeaf = takeNavLeaf(byPath, consumed, '/dashboard', 'Thống kê bán hàng')
  if (dashboardLeaf) {
    insightsChildren.push({
      ...dashboardLeaf,
      icon: 'dashboard',
    })
  }

  const reportsParent = byPath.get('/reports/end-of-day')
    || byPath.get('/reports')
    || items.find((item) => item.module === 'reports' && item.children?.length)
  if (reportsParent) {
    consumed.add(reportsParent.path)
    for (const child of reportsParent.children || []) {
      if (child.path === '/reports' || child.path === '/reports/') continue
      insightsChildren.push({
        label: child.label,
        path: child.path,
        module: child.module || 'reports',
        roles: child.roles,
      })
    }
  } else {
    const leaf = takeNavLeaf(byPath, consumed, '/reports/end-of-day', 'Báo cáo cuối ngày')
    if (leaf) insightsChildren.push(leaf)
  }

  if (insightsChildren.length) {
    const insightsGroup = {
      label: 'Thống kê & Báo cáo',
      icon: 'analytics',
      path: '__grp_insights',
      module: 'dashboard',
      isGroup: true,
      children: insightsChildren,
    }
    if (isAdmin) {
      result.unshift(insightsGroup)
    } else {
      result.push(insightsGroup)
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
    if (child.roles?.length && !hasAnyRoleGroup(roles, child.roles)) return false
    if (!child.module) return true
    if (!isSidebarModuleEnabled(child.module)) return false
    if (allowedModules.has(child.module)) return true
    if (roles.length && child.roles?.length && hasAnyRoleGroup(roles, child.roles)) return true
    return false
  })
}

function filterRoleChildren(children = [], roles = []) {
  return children.filter((child) => {
    if (child.roles?.length) return hasAnyRoleGroup(roles, child.roles)
    if (!child.module && !child.roles?.length) return true
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

  if (hasAnyRoleGroup(roles, ['accountant', 'salesStaff'])) {
    return groupSalesAccountantInsights(items, session)
  }

  return items
}

/** Sale / Kế toán: gom Thống kê + Báo cáo thành một nhóm gọn. */
function groupSalesAccountantInsights(items, session = null) {
  const byPath = new Map(items.map((item) => [item.path, item]))
  const consumed = new Set()
  const result = []

  const insightsChildren = []
  const dashboard = byPath.get('/dashboard')
  if (dashboard) {
    consumed.add('/dashboard')
    insightsChildren.push({
      label: 'Thống kê bán hàng',
      path: '/dashboard',
      module: 'dashboard',
    })
  }

  const reports = byPath.get('/reports/end-of-day')
    || byPath.get('/reports')
    || items.find((item) => item.module === 'reports' && item.children?.length)
  if (reports) {
    consumed.add(reports.path)
    for (const child of reports.children || []) {
      if (child.path === '/reports' || child.path === '/reports/') continue
      const isEndOfDay = child.path === '/reports/end-of-day' || child.path?.startsWith('/reports/end-of-day')
      // Sale POS / Sale COD: ẩn Báo cáo cuối ngày trong Thống kê & Báo cáo (chỉ Manager/Kế toán).
      if (isEndOfDay && (isSaleCodOnlySession(session) || isSalePosOnlySession(session))) {
        continue
      }
      insightsChildren.push({
        label: child.label,
        path: child.path,
        module: child.module || 'reports',
        roles: child.roles,
      })
    }
  }

  if (insightsChildren.length) {
    result.push({
      label: 'Thống kê & Báo cáo',
      icon: 'analytics',
      path: '__grp_insights',
      module: 'dashboard',
      isGroup: true,
      children: insightsChildren,
    })
  }

  for (const item of items) {
    if (!consumed.has(item.path)) result.push(item)
  }
  return result
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

const ROLE_HOME_ROUTES = {
  accountant: '/dashboard',
}

export function resolveHomeRoute(authSession) {
  if (!authSession) {
    return '/login'
  }

  const roles = authSession.roles ?? []

  // Admin → Quản lý tài khoản
  if (isAdminSession(roles) || hasPermissionManageRole(authSession)) {
    return '/admin/users'
  }

  // Manager → Nhân sự
  if (isAgencyManagerSession(roles)) {
    return '/staff'
  }

  // Thủ kho → Tồn kho / Kho
  if (hasAnyRoleGroup(roles, ['inventoryManager'])) {
    return '/inventory'
  }

  for (const [groupKey, route] of Object.entries(ROLE_HOME_ROUTES)) {
    if (hasAnyRoleGroup(roles, [groupKey])) return route
  }

  const homeRoute = authSession.modules?.length
    ? getHomeRouteForModules(authSession.modules)
    : getHomeRouteForRoles(roles)

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
  { module: 'products', prefix: '/products/categories' },
  { module: 'products', prefix: '/inventory/products' },
  { module: 'stock_transfer_ops', prefix: '/inventory/stock-transfers' },
  { module: 'stock_transfer_ops', prefix: '/inventory/shelf-replenishment-suggestions' },
  { module: 'stock_adjustment_ops', prefix: '/inventory/stock-requests' },
  { module: 'supplier_receipt_create', prefix: '/inventory/import/create' },
  { module: 'supplier_receipts', prefix: '/inventory/supplier-receipts' },
  { module: 'supplier_receipts', prefix: '/inventory/suppliers' },
  { module: 'supplier_receipts', prefix: '/inventory/supplier-products' },
  { module: 'warehouse_batches', prefix: '/inventory/batches' },
  { module: 'inventory_returns', prefix: '/inventory/return-inspections' },
  { module: 'inventory_returns', prefix: '/inventory/returns' },
  { module: 'inventory_stocktake', prefix: '/inventory/stocktake' },
  { module: 'production_orders', prefix: '/inventory/production-orders' },
  { module: 'inventory_reports', prefix: '/inventory/reports' },
  { module: 'inventory_ledger', prefix: '/inventory/ledger' },
  { module: 'warehouse_daily_report', prefix: '/inventory/warehouse-daily-report' },
  { module: 'inventory_statistics', prefix: '/inventory/statistics' },
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

  if (String(module).toLowerCase() === 'inventory_sync_monitor') {
    if (
      session?.permissions?.includes('MONITOR_OUTBOX')
      || session?.permissions?.includes('MANAGE_ROLE')
    ) {
      return true
    }
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

  // Sale (quầy/COD) không dùng kiểm kê kệ / YC bổ sung kệ — chỉ Manager / Thủ kho / Admin.
  if (
    (String(module).toLowerCase() === 'inventory_stocktake'
      || String(module).toLowerCase() === 'stock_adjustment_ops')
    && isSaleOnlySession(session)
  ) {
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

  // Live báo cáo cuối ngày: chỉ Thủ kho. Admin/Manager chỉ xem /submissions.
  const liveDaily = '/inventory/warehouse-daily-report'
  const submissionsDaily = `${liveDaily}/submissions`
  if (path === liveDaily) {
    const permissions = session?.permissions ?? []
    return (
      permissions.includes('SUBMIT_WAREHOUSE_REPORT')
      || permissions.includes('OPERATE_WAREHOUSE')
    )
  }
  if (path === submissionsDaily || path.startsWith(`${submissionsDaily}/`)) {
    return canAccessModule(session, 'warehouse_daily_report')
  }

  // Báo cáo cuối ngày (Back-Office): Sale POS/COD không vào — họ dùng Báo cáo chốt ca trên POS.
  if (path === '/reports/end-of-day' || path.startsWith('/reports/end-of-day')) {
    if (isSaleCodOnlySession(session) || isSalePosOnlySession(session)) {
      return false
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

function isSalePosOnlySession(session) {
  const permissions = session?.permissions ?? []
  const canViewAll =
    permissions.includes('VIEW_ALL_CUSTOMERS')
    || permissions.includes('MANAGE_EMPLOYEE')
    || permissions.includes('MANAGE_ROLE')
  return (
    !canViewAll
    && permissions.includes('CREATE_POS_ORDER')
    && !permissions.includes('CREATE_COD_ORDER')
  )
}

/** Sale thuần (quầy và/hoặc COD), không kiêm Manager/Admin/Thủ kho. */
function isSaleOnlySession(session) {
  const permissions = session?.permissions ?? []
  const canViewAll =
    permissions.includes('VIEW_ALL_CUSTOMERS')
    || permissions.includes('MANAGE_EMPLOYEE')
    || permissions.includes('MANAGE_ROLE')
  if (canViewAll) return false
  if (permissions.includes('OPERATE_WAREHOUSE') || permissions.includes('APPROVE_INVENTORY')) {
    return false
  }
  return (
    permissions.includes('CREATE_POS_ORDER')
    || permissions.includes('CREATE_COD_ORDER')
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
  if (module === 'stock_adjustment_ops') {
    return 'Chỉ Quản lý, Thủ kho hoặc Admin được xem Yêu cầu bổ sung Kệ Hàng; Sale không dùng chức năng này.'
  }
  if (module === 'inventory_stocktake') {
    return 'Chỉ Thủ kho, Quản lý hoặc Admin được kiểm kê tồn kho; Sale không dùng chức năng này.'
  }
  if (module === 'stock_transfer_ops') {
    return 'Chỉ Thủ kho, Quản lý hoặc Admin được xem điều chuyển Kho → Kệ; chỉ Thủ kho không có role Admin được thao tác.'
  }
  if (module === 'inventory') {
    return 'Chỉ Thủ kho Kho tổng mới được truy cập module kho tổng.'
  }
  if (module === 'promotions_admin' || module === 'membership_tiers_admin' || module === 'system_activity_log') {
    return 'Chỉ Admin mới được quản lý hạng thẻ và mã giảm giá.'
  }
  if (module === 'inventory_sync_monitor') {
    return 'Chỉ Admin (hoặc tài khoản có quyền MONITOR_OUTBOX) mới được theo dõi đồng bộ Outbox.'
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
    // Exact /orders/cod (incl. ?view=report) — do not treat child paths as active.
    return path === target || orderDetailContext === 'cod'
  }

  if (item.module === 'stock_deduct_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'stock_adjustment_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'stock_transfer_ops') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'inventory') {
    if (
      path === '/inventory/stock-transfers'
      || path.startsWith('/inventory/stock-transfers/')
      || path === '/inventory/shelf-replenishment-suggestions'
      || path === '/inventory/stock-requests'
      || path.startsWith('/inventory/stock-requests/')
    ) {
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
    return (
      path === target
      || path.startsWith(`${target}/`)
      || path === '/inventory/warehouse-daily-report'
      || path.startsWith('/inventory/warehouse-daily-report/')
    )
  }

  // Live vs đã gửi: path live là prefix của /submissions → không dùng startsWith chung.
  if (item.module === 'warehouse_daily_report') {
    const submissionsPrefix = '/inventory/warehouse-daily-report/submissions'
    if (target === submissionsPrefix || target.startsWith(`${submissionsPrefix}/`)) {
      return path === submissionsPrefix || path.startsWith(`${submissionsPrefix}/`)
    }
    return path === '/inventory/warehouse-daily-report'
  }

  if (item.module === 'products') {
    return path === target || path.startsWith(`${target}/`)
  }

  if (item.module === 'orders') {
    // Các route anh em dưới /orders — không được kích hoạt "Quản Lý Đơn POS" (/orders).
    const isOrdersSiblingPath = (current) =>
      current === '/orders/create'
      || current.startsWith('/orders/create/')
      || current === '/orders/cod'
      || current.startsWith('/orders/cod/')
      || current === '/orders/b2b-debts'
      || current.startsWith('/orders/b2b-debts/')
      || current === '/orders/exchange'
      || current.startsWith('/orders/exchange/')
      || current === '/orders/returns'
      || current.startsWith('/orders/returns/')
      || current === '/orders/stock-deduct'
      || current.startsWith('/orders/stock-deduct/')

    if (target === '/orders/exchange') {
      return (
        path === '/orders/exchange'
        || path.startsWith('/orders/exchange/')
        || path === '/orders/returns'
        || path.startsWith('/orders/returns/')
        || orderDetailContext === 'exchange'
      )
    }

    if (target === '/orders/create') {
      return path === '/orders/create' || path.startsWith('/orders/create/')
    }

    if (target === '/orders/b2b-debts') {
      return path === target || path.startsWith(`${target}/`)
    }

    // Mục "Quản Lý Đơn POS" (path=/orders) và các mục orders khác trừ sibling.
    if (target === '/orders') {
      if (isOrdersSiblingPath(path)) return false
      if (orderDetailContext === 'exchange' || orderDetailContext === 'cod') return false
      return path === '/orders' || path.startsWith('/orders/')
    }

    if (isOrdersSiblingPath(path) && !(path === target || path.startsWith(`${target}/`))) {
      return false
    }
    if (orderDetailContext === 'exchange' || orderDetailContext === 'cod') {
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

  if (item.module === 'reports') {
    if (target === '/reports' || target === '/reports/end-of-day') {
      return path === '/reports' || path === '/reports/end-of-day' || path.startsWith('/reports/end-of-day/')
    }
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
