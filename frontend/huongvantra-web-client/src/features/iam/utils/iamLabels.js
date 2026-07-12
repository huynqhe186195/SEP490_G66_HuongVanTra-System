/** Nhãn tiếng Việt cho vai trò và quyền — dễ hiểu cho người dùng lớn tuổi. */

export const ROLE_LABELS = {
  Admin: 'Quản trị viên',
  Manager: 'Quản lý chi nhánh',
  Sale: 'Nhân viên bán hàng',
  Warehouse: 'Thủ kho Kho tổng',
  Accountant: 'Kế toán',
}

export const PERMISSION_LABELS = {
  CREATE_ORDER: {
    label: 'Tạo đơn hàng',
    hint: 'Được phép lập đơn bán hàng mới',
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
}

export function formatRoleName(roleName) {
  if (!roleName) return '—'
  return ROLE_LABELS[roleName] || roleName
}

export function formatPermissionName(permissionName) {
  if (!permissionName) return '—'
  return PERMISSION_LABELS[permissionName]?.label || permissionName.replace(/_/g, ' ').toLowerCase()
}

export function getPermissionHint(permissionName) {
  return PERMISSION_LABELS[permissionName]?.hint || 'Quyền thao tác trên hệ thống'
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
