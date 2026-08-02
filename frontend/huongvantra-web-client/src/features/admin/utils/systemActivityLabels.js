import { formatRoleName } from '../../iam/utils/iamLabels.js'

const SERVICE_LABELS = {
  InventoryService: 'Dịch vụ kho',
  OrderService: 'Dịch vụ đơn hàng',
  ProductService: 'Dịch vụ sản phẩm',
  UserService: 'Dịch vụ người dùng',
  CustomerService: 'Dịch vụ khách hàng',
  DocumentService: 'Dịch vụ tài liệu',
  AuditService: 'Dịch vụ kiểm toán',
  Inventory: 'Kho',
  Order: 'Đơn hàng',
  Product: 'Sản phẩm',
  User: 'Người dùng',
  Customer: 'Khách hàng',
  Document: 'Tài liệu',
}

const MODULE_LABELS = {
  auth: 'Xác thực',
  catalog: 'Danh mục hàng',
  employees: 'Nhân sự',
  inventory: 'Kho',
  notifications: 'Thông báo',
  orders: 'Đơn hàng',
  payments: 'Thanh toán',
  pos: 'POS bán hàng',
  'product-creation-requests': 'Yêu cầu tạo hàng',
  promotions: 'Mã giảm giá',
  shifts: 'Lịch làm việc',
  'stock-deduct-queue': 'Hàng đợi trừ kho',
  users: 'Tài khoản',
  roles: 'Vai trò',
  permissions: 'Quyền',
  suppliers: 'Nhà cung cấp',
  'supplier-receipts': 'Phiếu nhập NCC',
  production: 'Sản xuất',
  stocktakes: 'Kiểm kê',
  transfers: 'Điều chuyển',
  returns: 'Trả hàng',
  customers: 'Khách hàng',
  contracts: 'Hợp đồng',
}

const METHOD_LABELS = {
  GET: 'Xem',
  POST: 'Thực hiện',
  PUT: 'Cập nhật',
  PATCH: 'Cập nhật',
  DELETE: 'Xóa',
}

const ACTION_PATH_RULES = [
  { match: /change-password/i, label: 'Đổi mật khẩu' },
  { match: /reset-password/i, label: 'Đặt lại mật khẩu' },
  { match: /update-profile/i, label: 'Cập nhật hồ sơ' },
  { match: /\/logout/i, label: 'Đăng xuất' },
  { match: /\/login/i, label: 'Đăng nhập' },
  { match: /cash-sessions.*\/open/i, label: 'Mở quỹ ca POS' },
  { match: /cash-sessions.*\/close/i, label: 'Đóng quỹ ca POS' },
  { match: /stock-deduct-queue.*\/confirm/i, label: 'Xác nhận trừ kho' },
  { match: /stock-deduct-queue.*\/reject/i, label: 'Từ chối trừ kho' },
  { match: /custom-bundles.*\/pack/i, label: 'Đóng gói combo tùy chỉnh' },
  { match: /registration-windows.*\/close/i, label: 'Đóng cửa sổ đăng ký ca' },
  { match: /registrations.*\/approve/i, label: 'Duyệt đăng ký ca' },
  { match: /registrations.*\/reject/i, label: 'Từ chối đăng ký ca' },
  { match: /registrations.*\/unassign/i, label: 'Gỡ phân công ca' },
  { match: /slots.*\/assign/i, label: 'Phân công ca' },
  { match: /slots.*\/register/i, label: 'Đăng ký ca' },
  { match: /promotions\/applicable/i, label: 'Áp dụng mã giảm giá' },
  { match: /\/users\//i, label: 'Thao tác tài khoản' },
  { match: /\/employees/i, label: 'Thao tác nhân sự' },
  { match: /\/orders/i, label: 'Thao tác đơn hàng' },
  { match: /\/products/i, label: 'Thao tác sản phẩm' },
  { match: /\/inventory/i, label: 'Thao tác kho' },
]

export function formatActivityService(serviceName) {
  if (!serviceName) return '—'
  return SERVICE_LABELS[serviceName] || serviceName.replace(/Service$/i, '')
}

export function formatActivityModule(moduleName) {
  if (!moduleName) return '—'
  const key = String(moduleName).trim()
  return MODULE_LABELS[key] || MODULE_LABELS[key.toLowerCase()] || key
}

export function formatActivityAction(action) {
  if (!action) return '—'
  const raw = String(action).trim()
  const methodMatch = raw.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i)
  if (!methodMatch) return raw

  const method = methodMatch[1].toUpperCase()
  const path = methodMatch[2]
  const methodVi = METHOD_LABELS[method] || method

  for (const rule of ACTION_PATH_RULES) {
    if (rule.match.test(path)) {
      return `${methodVi}: ${rule.label}`
    }
  }

  // Rút gọn path API cho dễ đọc
  const shortPath = path
    .replace(/^\/api\/v1\b/i, '')
    .replace(/^\/api\b/i, '')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '')
    .replace(/\/\d+/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')

  return `${methodVi} ${shortPath || path}`
}

export function formatActivityActorRole(role) {
  return formatRoleName(role)
}

export function formatEntityType(entityType) {
  if (!entityType) return '—'
  const map = {
    User: 'Tài khoản',
    Employee: 'Nhân viên',
    Role: 'Vai trò',
    Permission: 'Quyền',
    Order: 'Đơn hàng',
    Product: 'Sản phẩm',
    ProductSku: 'SKU',
    Customer: 'Khách hàng',
    StockDeductQueue: 'Hàng đợi trừ kho',
    ShiftSlot: 'Ca làm việc',
    ShiftRegistration: 'Đăng ký ca',
    ShiftRegistrationWindow: 'Cửa sổ đăng ký ca',
    PosCashSession: 'Quỹ ca POS',
    Promotion: 'Mã giảm giá',
    SupplierReceipt: 'Phiếu nhập NCC',
    ProductionOrder: 'Lệnh sản xuất',
    StockTransfer: 'Phiếu điều chuyển',
    StocktakeRequest: 'Phiếu kiểm kê',
    WarehouseDailyReportSubmission: 'Báo cáo cuối ngày kho',
  }
  return map[entityType] || entityType
}
