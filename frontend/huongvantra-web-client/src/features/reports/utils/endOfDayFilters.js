/**
 * Nguồn sự thật duy nhất cho bộ lọc màn hình Báo cáo cuối ngày.
 *
 * Bộ lọc được lưu trong query string của URL để F5 hoặc chia sẻ link vẫn giữ nguyên
 * điều kiện lọc, và để bản PDF/Excel xuất ra đúng bộ lọc đang áp dụng.
 */

/** Trả về chuỗi yyyy-MM-dd theo giờ máy người dùng (không dùng toISOString vì lệch múi giờ). */
export function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayInputValue() {
  return toDateInputValue(new Date())
}

export const DEFAULT_FILTERS = Object.freeze({
  date: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  employeeId: '',
  customerId: '',
  creatorId: '',
  channel: '',
  orderStatus: '',
  paymentMethod: '',
  salesMode: '',
})

/**
 * "Mối quan tâm" — chọn xem tài liệu báo cáo nào trong cùng một khung xem.
 * Đây KHÔNG phải tab: đổi giá trị này là đổi hẳn tài liệu đang hiển thị, bộ lọc giữ nguyên.
 *
 * Ngoại lệ cố ý không có mục riêng; số liệu ngoại lệ nằm trong Tổng hợp và Kho/Kệ.
 */
export const CONCERNS = Object.freeze([
  { key: 'sales', label: 'Bán hàng', title: 'BÁO CÁO CUỐI NGÀY VỀ BÁN HÀNG', icon: 'receipt_long' },
  { key: 'payments', label: 'Thanh toán', title: 'BÁO CÁO CUỐI NGÀY VỀ THANH TOÁN', icon: 'payments' },
  { key: 'products', label: 'Hàng hóa', title: 'BÁO CÁO CUỐI NGÀY VỀ HÀNG HÓA', icon: 'inventory_2' },
  { key: 'inventory', label: 'Kho/Kệ', title: 'BÁO CÁO CUỐI NGÀY VỀ KHO/KỆ', icon: 'warehouse' },
  { key: 'summary', label: 'Tổng hợp', title: 'BÁO CÁO CUỐI NGÀY - TỔNG HỢP', icon: 'summarize' },
])

export const DEFAULT_CONCERN = 'sales'

export function concernMeta(key) {
  return CONCERNS.find((c) => c.key === key) || CONCERNS[0]
}

export function parseConcernFromSearchParams(searchParams) {
  const concern = searchParams.get('concern')
  return CONCERNS.some((c) => c.key === concern) ? concern : DEFAULT_CONCERN
}

/**
 * Kiểu hiển thị của tài liệu báo cáo.
 * - 'report': khổ dọc, đúng tờ A4 dọc.
 * - 'wide' : khổ ngang, dành cho báo cáo nhiều cột.
 * Giá trị này cũng là khổ giấy mặc định khi in/xuất PDF.
 */
export const LAYOUTS = Object.freeze([
  { key: 'report', label: 'Báo cáo', icon: 'description', orientation: 'portrait' },
  { key: 'wide', label: 'Ngang', icon: 'crop_landscape', orientation: 'landscape' },
])

export const DEFAULT_LAYOUT = 'report'

export function parseLayoutFromSearchParams(searchParams) {
  const layout = searchParams.get('layout')
  return LAYOUTS.some((l) => l.key === layout) ? layout : DEFAULT_LAYOUT
}

export function layoutToOrientation(layout) {
  return layout === 'wide' ? 'landscape' : 'portrait'
}

/**
 * Bộ lọc nào thực sự được endpoint của từng mối quan tâm chấp nhận.
 *
 * Lấy đúng theo danh sách tham số trong `services/endOfDayApi.js`: filter không nằm ở đây
 * sẽ bị vô hiệu hóa trên panel thay vì gửi đi rồi bị backend bỏ qua trong im lặng.
 * Nhóm endpoint Kho/Kệ chỉ nhận khoảng ngày nên không có filter nghiệp vụ nào.
 */
export const CONCERN_FILTER_SUPPORT = Object.freeze({
  sales: ['employeeId', 'customerId', 'channel', 'paymentMethod', 'salesMode', 'orderStatus'],
  payments: ['employeeId', 'customerId', 'channel', 'paymentMethod', 'salesMode'],
  products: ['employeeId', 'customerId', 'channel', 'salesMode'],
  inventory: [],
  summary: ['employeeId', 'customerId', 'channel', 'paymentMethod', 'salesMode', 'orderStatus'],
})

/**
 * Bộ lọc có trong thiết kế nhưng backend hiện chưa nhận. Hiển thị ở trạng thái vô hiệu
 * kèm lý do, không gửi lên API và không tự suy diễn ở frontend.
 */
export const UNSUPPORTED_FILTERS = Object.freeze({
  creatorId: 'API báo cáo cuối ngày chưa tách "Người tạo phiếu" khỏi "Nhân viên bán hàng".',
  timeFrom: 'Kỳ báo cáo tính trọn ngày dương lịch GMT+7; API chưa nhận khung giờ.',
  timeTo: 'Kỳ báo cáo tính trọn ngày dương lịch GMT+7; API chưa nhận khung giờ.',
})

export function supportsFilter(concern, key) {
  return (CONCERN_FILTER_SUPPORT[concern] || []).includes(key)
}

/**
 * Bỏ khỏi bộ lọc những khóa mà mối quan tâm đang xem không hỗ trợ.
 *
 * Giá trị vẫn nằm nguyên trong URL để khi quay lại mối quan tâm hỗ trợ nó thì không mất,
 * nhưng không được gửi lên endpoint không đọc tới nó — gửi đi mà backend bỏ qua sẽ khiến
 * người dùng tin rằng báo cáo đã lọc trong khi thực tế chưa.
 */
export function filtersForConcern(filters, concern) {
  const supported = CONCERN_FILTER_SUPPORT[concern] || []
  const next = { date: filters?.date || '', dateTo: filters?.dateTo || '' }
  for (const key of ['employeeId', 'customerId', 'channel', 'orderStatus', 'paymentMethod', 'salesMode']) {
    next[key] = supported.includes(key) ? filters?.[key] || '' : ''
  }
  return next
}

export const QUICK_RANGES = Object.freeze([
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7', label: '7 ngày' },
  { key: 'custom', label: 'Tùy chọn' },
])

/** Chuyển một lựa chọn nhanh thành cặp ngày. 'custom' giữ nguyên ngày đang chọn. */
export function quickRangeToDates(key, current) {
  const today = new Date()
  if (key === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    return { date: toDateInputValue(y), dateTo: '' }
  }
  if (key === 'last7') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { date: toDateInputValue(start), dateTo: toDateInputValue(today) }
  }
  if (key === 'custom') {
    return { date: current?.date || todayInputValue(), dateTo: current?.dateTo || '' }
  }
  return { date: toDateInputValue(today), dateTo: '' }
}

/** Suy ngược lựa chọn nhanh nào đang khớp với cặp ngày hiện tại. */
export function detectQuickRange(filters) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - 6)

  if (!filters.dateTo) {
    if (filters.date === toDateInputValue(today)) return 'today'
    if (filters.date === toDateInputValue(yesterday)) return 'yesterday'
  } else if (filters.date === toDateInputValue(weekStart) && filters.dateTo === toDateInputValue(today)) {
    return 'last7'
  }
  return 'custom'
}

/** Báo cáo nhiều ngày đổi tiêu đề thành "Báo cáo bán hàng theo kỳ". */
export function isMultiDay(filters) {
  return Boolean(filters?.dateTo) && filters.dateTo !== filters.date
}

export function parseFiltersFromSearchParams(searchParams) {
  const get = (key) => searchParams.get(key) || ''
  return {
    date: get('date') || todayInputValue(),
    dateTo: get('dateTo'),
    timeFrom: get('timeFrom'),
    timeTo: get('timeTo'),
    employeeId: get('employeeId'),
    customerId: get('customerId'),
    creatorId: get('creatorId'),
    channel: get('channel'),
    orderStatus: get('orderStatus'),
    paymentMethod: get('paymentMethod'),
    salesMode: get('salesMode'),
  }
}

/**
 * Ghi bộ lọc vào URLSearchParams. Giữ lại param lạ (ví dụ concern) do caller truyền vào,
 * bỏ giá trị rỗng và giá trị mặc định để URL gọn.
 */
export function filtersToSearchParams(filters, base) {
  const params = new URLSearchParams(base || undefined)
  const write = (key, value, skipWhen) => {
    if (!value || value === skipWhen) params.delete(key)
    else params.set(key, value)
  }
  write('date', filters.date, todayInputValue())
  write('dateTo', filters.dateTo)
  write('timeFrom', filters.timeFrom)
  write('timeTo', filters.timeTo)
  write('employeeId', filters.employeeId)
  write('customerId', filters.customerId)
  write('creatorId', filters.creatorId)
  write('channel', filters.channel)
  write('orderStatus', filters.orderStatus)
  write('paymentMethod', filters.paymentMethod)
  write('salesMode', filters.salesMode)
  return params
}

/** Số bộ lọc nâng cao đang bật — hiển thị badge trên nút "Bộ lọc nâng cao". */
export function countAdvancedFilters(filters) {
  return ['employeeId', 'customerId', 'creatorId', 'channel', 'orderStatus', 'paymentMethod', 'salesMode']
    .filter((key) => Boolean(filters[key])).length
}

/**
 * Tham số cho nhóm API Báo cáo cuối ngày (`/api/reports/end-of-day/*` và
 * `/api/v1/inventory/reports/end-of-day/*`).
 *
 * Gửi thẳng ngày lịch `yyyy-MM-dd`; backend quy đổi sang mốc 00:00 GMT+7. Cố tình KHÔNG
 * dựng `new Date(y, m, d)` rồi `toISOString()` như hàm cũ bên dưới — cách đó lấy múi giờ
 * của máy người dùng nên máy đặt sai timezone sẽ lệch hẳn một ngày báo cáo.
 */
export function filtersToEodParams(filters) {
  const startDay = filters?.date || todayInputValue()
  const endDay = filters?.dateTo || startDay

  const params = startDay === endDay ? { date: startDay } : { fromDate: startDay, toDate: endDay }
  if (filters?.employeeId) params.employeeId = filters.employeeId
  if (filters?.customerId) params.customerId = filters.customerId
  if (filters?.channel) params.channel = filters.channel
  if (filters?.orderStatus) params.orderStatus = filters.orderStatus
  if (filters?.paymentMethod) params.paymentMethod = filters.paymentMethod
  if (filters?.salesMode) params.salesMode = filters.salesMode
  return params
}

/**
 * Chuyển bộ lọc màn hình thành tham số gọi API báo cáo CŨ (`/api/Reports/*`).
 * Giữ nguyên vì các endpoint cũ vẫn nhận ISO UTC.
 */
export function filtersToApiParams(filters) {
  const startDay = filters.date || todayInputValue()
  const endDay = filters.dateTo || startDay
  const [sy, sm, sd] = startDay.split('-').map(Number)
  const [ey, em, ed] = endDay.split('-').map(Number)
  const from = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const to = new Date(ey, em - 1, ed, 23, 59, 59, 999)

  const params = { fromDate: from.toISOString(), toDate: to.toISOString() }
  if (filters.employeeId) params.employeeId = filters.employeeId
  if (filters.customerId) params.customerId = filters.customerId
  if (filters.channel) params.channel = filters.channel
  if (filters.orderStatus) params.orderStatus = filters.orderStatus
  if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod
  if (filters.salesMode) params.salesMode = filters.salesMode
  return params
}
