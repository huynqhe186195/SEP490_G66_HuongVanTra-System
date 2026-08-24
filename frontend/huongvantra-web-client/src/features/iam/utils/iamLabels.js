/** Nhãn tiếng Việt cho vai trò và quyền — dễ hiểu cho người dùng lớn tuổi. */

export const ROLE_LABELS = {
  Admin: 'Quản trị viên',
  Manager: 'Quản lý',
  Sale: 'Sale (cũ — nên chuyển SalePos/SaleCod)',
  SalePos: 'Nhân viên bán hàng quầy',
  SaleCod: 'Nhân viên bán/thu COD',
  Warehouse: 'Thủ kho',
  Accountant: 'Kế toán',
}

/** Vai trò legacy — không hiện trên IAM / gán quyền. */
export const RETIRED_ROLE_NAMES = new Set(['CooperativeOwner'])

export function isRetiredRoleName(roleName) {
  return RETIRED_ROLE_NAMES.has(String(roleName || '').trim())
}

export const PERMISSION_LABELS = {
  CREATE_ORDER: {
    label: 'Tạo đơn hàng',
    hint: 'Được phép lập đơn bán hàng mới',
  },
  CREATE_POS_ORDER: {
    label: 'Tạo đơn tại quầy',
    hint: 'Được phép lập đơn bán trực tiếp tại quầy POS',
  },
  CREATE_COD_ORDER: {
    label: 'Tạo đơn COD',
    hint: 'Được phép lập đơn giao hàng thu tiền COD',
  },
  VERIFY_COD: {
    label: 'Xác nhận thanh toán COD',
    hint: 'Được phép xác nhận và thu tiền cho thanh toán COD',
  },
  VIEW_ORDER: {
    label: 'Xem đơn hàng',
    hint: 'Được phép xem danh sách và chi tiết đơn',
  },
  CREATE_CUSTOMER: {
    label: 'Thêm khách hàng',
    hint: 'Được phép tạo hồ sơ khách mới',
  },
  VIEW_CUSTOMER: {
    label: 'Xem khách hàng',
    hint: 'Được phép xem thông tin khách',
  },
  VIEW_ALL_CUSTOMERS: {
    label: 'Xem tất cả khách',
    hint: 'Được xem khách của toàn hệ thống, không chỉ của mình',
  },
  MANAGE_EMPLOYEE: {
    label: 'Quản lý nhân sự',
    hint: 'Thêm, sửa, ngừng hoạt động nhân viên',
  },
  MANAGE_USER: {
    label: 'Quản lý tài khoản',
    hint: 'Tạo và quản lý tài khoản đăng nhập',
  },
  MANAGE_ROLE: {
    label: 'Quản lý phân quyền',
    hint: 'Thiết lập vai trò và quyền trong hệ thống',
  },
  MANAGE_CATALOG: {
    label: 'Quản lý danh mục hàng',
    hint: 'Tạo và cập nhật sản phẩm, danh mục, biến thể SKU',
  },
  VIEW_CATALOG: {
    label: 'Xem danh mục hàng',
    hint: 'Xem sản phẩm, danh mục và SKU (không sửa)',
  },
  SYNC_CATALOG: {
    label: 'Đồng bộ danh mục xuống quầy',
    hint: 'Đồng bộ danh mục kho xuống danh mục bán tại quầy',
  },
  APPROVE_PRICE: {
    label: 'Duyệt đổi giá bán (cũ)',
    hint: 'Quyền cũ — nên dùng Duyệt yêu cầu đổi giá bán',
  },
  REQUEST_RETAIL_PRICE_CHANGE: {
    label: 'Yêu cầu đổi giá bán',
    hint: 'Kế toán tạo yêu cầu thay đổi giá bán lẻ',
  },
  APPROVE_RETAIL_PRICE_CHANGE: {
    label: 'Duyệt yêu cầu đổi giá bán',
    hint: 'Phê duyệt hoặc từ chối yêu cầu đổi giá bán lẻ',
  },
  APPROVE_CONTRACT: {
    label: 'Duyệt hợp đồng',
    hint: 'Được phép phê duyệt hợp đồng khách hàng',
  },
  MANAGE_BUSINESS_POLICY: {
    label: 'Chính sách kinh doanh',
    hint: 'Xem báo cáo doanh thu đầy đủ và chính sách hệ thống',
  },
  MONITOR_OUTBOX: {
    label: 'Theo dõi đồng bộ tồn',
    hint: 'Xem và xử lý hàng đợi đồng bộ tồn kho (Outbox)',
  },
  VIEW_INVENTORY: {
    label: 'Xem kho',
    hint: 'Xem tồn kho, thống kê, báo cáo và nhật ký kho',
  },
  OPERATE_WAREHOUSE: {
    label: 'Vận hành kho',
    hint: 'Nhập hàng, sản xuất, điều chuyển, trừ kho và thao tác ghi kho',
  },
  APPROVE_INVENTORY: {
    label: 'Duyệt nghiệp vụ kho',
    hint: 'Duyệt phiếu nhập, yêu cầu kệ, sản xuất, kiểm kê…',
  },
  REJECT_STOCK_DEDUCT: {
    label: 'Từ chối trừ kho',
    hint: 'Được phép từ chối hàng đợi trừ kho / đóng gói',
  },
  MANAGE_SUPPLIERS: {
    label: 'Quản lý nhà cung cấp',
    hint: 'Thêm, sửa hồ sơ nhà cung cấp (Manager, Thủ kho)',
  },
  DELETE_SUPPLIER: {
    label: 'Ẩn/khôi phục nhà cung cấp',
    hint: 'Ẩn hoặc khôi phục nhà cung cấp (chỉ Manager)',
  },
  MANAGE_SUPPLIER_PRODUCT: {
    label: 'Quản lý mặt hàng nhà cung cấp',
    hint: 'Thêm, sửa sản phẩm và giá chào theo NCC',
  },
  MANAGE_COST: {
    label: 'Quản lý giá vốn',
    hint: 'Cập nhật giá vốn sản phẩm',
  },
  VIEW_COST: {
    label: 'Xem giá vốn',
    hint: 'Xem bảng giá vốn / giá bán',
  },
  SUBMIT_WAREHOUSE_REPORT: {
    label: 'Gửi báo cáo cuối ngày kho',
    hint: 'Thủ kho gửi báo cáo cuối ngày (mỗi ngày một lần)',
  },
  BROADCAST_NOTIFICATION: {
    label: 'Gửi thông báo hàng loạt',
    hint: 'Gửi thông báo tới nhóm vai trò (ví dụ báo cáo cuối ngày)',
  },
  VIEW_PRODUCT_REQUEST: {
    label: 'Xem yêu cầu tạo/xóa hàng',
    hint: 'Xem lịch sử yêu cầu tạo hoặc xóa sản phẩm',
  },
  APPROVE_PRODUCT_REQUEST: {
    label: 'Duyệt yêu cầu tạo/xóa hàng',
    hint: 'Phê duyệt hoặc từ chối yêu cầu tạo/xóa sản phẩm',
  },
  CREATE_SHELF_REPLENISHMENT: {
    label: 'Tạo yêu cầu bổ sung kệ',
    hint: 'Quản lý tạo yêu cầu bổ sung hàng từ kho lên kệ',
  },
  APPROVE_SHELF_REPLENISHMENT: {
    label: 'Xử lý yêu cầu bổ sung kệ',
    hint: 'Thủ kho xử lý / xác nhận chuyển hàng lên kệ',
  },
  PERFORM_RETURN_INSPECTION: {
    label: 'Kiểm tra hàng trả',
    hint: 'Quyết định bán lại hoặc tiêu hủy hàng khách trả',
  },
  MANAGE_STOCK_THRESHOLD: {
    label: 'Quản lý ngưỡng tồn',
    hint: 'Đặt ngưỡng cảnh báo tồn kệ (Quản lý) hoặc tồn kho (Thủ kho)',
  },
}

export function formatRoleName(roleName) {
  if (!roleName) return '—'
  if (ROLE_LABELS[roleName]) return ROLE_LABELS[roleName]
  const compact = String(roleName).replace(/\s+/g, '')
  const matched = Object.keys(ROLE_LABELS).find(
    (key) => key.toLowerCase() === compact.toLowerCase(),
  )
  return matched ? ROLE_LABELS[matched] : roleName
}

export function formatPermissionName(permissionName, permissionCode) {
  const code = permissionCode || permissionName
  if (!permissionName && !code) return '—'
  return PERMISSION_LABELS[code]?.label
    || (permissionName && permissionName !== code ? permissionName : null)
    || String(code).replace(/_/g, ' ')
}

export function getPermissionHint(permissionName, permissionCode) {
  const code = permissionCode || permissionName
  return PERMISSION_LABELS[code]?.hint || 'Quyền thao tác trên hệ thống'
}

/** Mô tả vai trò — ưu tiên mô tả từ API; dịch mô tả tiếng Anh phổ biến; fallback theo mã. */
const ROLE_DESCRIPTION_FALLBACKS = {
  Admin: 'Quản trị hệ thống: phân quyền, tài khoản, giám sát và duyệt chọn lọc.',
  Manager: 'Quản lý vận hành: đơn hàng, kho (duyệt), nhân sự, báo cáo.',
  Sale: 'Vai trò bán hàng cũ — nên chuyển sang SalePos hoặc SaleCod.',
  SalePos: 'Nhân viên bán hàng tại quầy POS.',
  SaleCod: 'Nhân viên tạo đơn và thu tiền COD.',
  Warehouse: 'Thủ kho: nhập hàng, sản xuất, điều chuyển, báo cáo cuối ngày.',
  Accountant: 'Kế toán: xem giá vốn, công nợ, báo cáo tài chính liên quan.',
}

const ROLE_DESCRIPTION_TRANSLATIONS = {
  'system administrator': ROLE_DESCRIPTION_FALLBACKS.Admin,
  'administrator': ROLE_DESCRIPTION_FALLBACKS.Admin,
  'manager': ROLE_DESCRIPTION_FALLBACKS.Manager,
  'warehouse staff': ROLE_DESCRIPTION_FALLBACKS.Warehouse,
  'accountant': ROLE_DESCRIPTION_FALLBACKS.Accountant,
}

export function formatRoleDescription(roleName, description) {
  const trimmed = String(description || '').trim()
  if (trimmed) {
    const translated = ROLE_DESCRIPTION_TRANSLATIONS[trimmed.toLowerCase()]
    if (translated) return translated
    return trimmed
  }
  return ROLE_DESCRIPTION_FALLBACKS[roleName] || ''
}

export const SOFT_DELETE_CONFIRM = {
  user: (name) =>
    `Bạn có chắc muốn NGỪNG SỬ DỤNG tài khoản "${name}"?\n\nTài khoản sẽ bị khóa và chuyển xuống danh sách bên dưới. Bạn có thể khôi phục sau.`,
  role: (name) =>
    `Bạn có chắc muốn NGỪNG SỬ DỤNG vai trò "${name}"?\n\nVai trò sẽ ẩn khỏi danh sách chính. Bạn có thể khôi phục sau.`,
  permission: (name) =>
    `Bạn có chắc muốn NGỪNG SỬ DỤNG quyền "${name}"?\n\nQuyền sẽ ẩn khỏi danh sách chính. Bạn có thể khôi phục sau.`,
}

export const RESTORE_CONFIRM = {
  user: (name) => `Khôi phục tài khoản "${name}"?\n\nTài khoản sẽ hoạt động trở lại.`,
  role: (name) => `Khôi phục vai trò "${name}"?`,
  permission: (name) => `Khôi phục quyền "${name}"?`,
}
