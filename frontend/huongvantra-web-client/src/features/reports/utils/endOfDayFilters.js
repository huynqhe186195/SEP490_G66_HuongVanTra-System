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
  employeeId: '',
  customerId: '',
  channel: '',
  orderStatus: '',
  paymentMethod: '',
  salesMode: '',
  /** 'summary' | 'detail' — thay cho kiểu hiển thị Dọc/Ngang cũ. */
  mode: 'summary',
})

export const DEFAULT_TAB = 'overview'

export const TABS = Object.freeze([
  { key: 'overview', label: 'Tổng quan' },
  { key: 'sales', label: 'Bán hàng' },
  { key: 'payments', label: 'Thanh toán và đối soát' },
  { key: 'products', label: 'Hàng hóa' },
  { key: 'inventory', label: 'Kho/Kệ' },
  { key: 'exceptions', label: 'Ngoại lệ' },
])

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
  const mode = get('mode') === 'detail' ? 'detail' : 'summary'
  return {
    date: get('date') || todayInputValue(),
    dateTo: get('dateTo'),
    employeeId: get('employeeId'),
    customerId: get('customerId'),
    channel: get('channel'),
    orderStatus: get('orderStatus'),
    paymentMethod: get('paymentMethod'),
    salesMode: get('salesMode'),
    mode,
  }
}

export function parseTabFromSearchParams(searchParams) {
  const tab = searchParams.get('tab')
  return TABS.some((t) => t.key === tab) ? tab : DEFAULT_TAB
}

/**
 * Ghi bộ lọc vào URLSearchParams. Giữ lại param lạ (ví dụ tab) do caller truyền vào,
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
  write('employeeId', filters.employeeId)
  write('customerId', filters.customerId)
  write('channel', filters.channel)
  write('orderStatus', filters.orderStatus)
  write('paymentMethod', filters.paymentMethod)
  write('salesMode', filters.salesMode)
  write('mode', filters.mode, 'summary')
  return params
}

/** Số bộ lọc nâng cao đang bật — hiển thị badge trên nút "Bộ lọc nâng cao". */
export function countAdvancedFilters(filters) {
  return ['employeeId', 'customerId', 'channel', 'orderStatus', 'paymentMethod', 'salesMode']
    .filter((key) => Boolean(filters[key])).length
}

/**
 * Chuyển bộ lọc màn hình thành tham số gọi API.
 * Khoảng thời gian tính theo giờ máy người dùng rồi gửi ISO (UTC) để backend so sánh đúng.
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
