import { apiRequestAuth } from '../../../lib/apiClient'

/**
 * Client cho API Báo cáo cuối ngày.
 *
 * Hai nhóm endpoint thuộc hai microservice khác nhau và không dùng chung tham số:
 * - OrderService `/api/reports/end-of-day/*` — bán hàng, thanh toán, hàng hóa.
 * - InventoryService `/api/v1/inventory/reports/end-of-day/*` — Kho/Kệ.
 *
 * Ngày gửi lên là ngày lịch GMT+7 dạng `yyyy-MM-dd`. Backend tự quy đổi sang mốc UTC,
 * nên ở đây không dựng Date local rồi gọi toISOString (dễ lệch ngày).
 *
 * File này không thay thế `reportsApi.js` — các endpoint báo cáo cũ vẫn giữ nguyên.
 */

const ORDER_EOD = '/api/reports/end-of-day'
const INVENTORY_EOD = '/api/v1/inventory/reports/end-of-day'

function qs(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, String(value))
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

/** Chỉ giữ những khóa endpoint thực sự dùng — tránh gửi query object quá rộng. */
function pick(source, keys) {
  const out = {}
  keys.forEach((key) => {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') out[key] = source[key]
  })
  return out
}

const DATE_KEYS = ['date', 'fromDate', 'toDate']

function get(path, params, { signal } = {}) {
  return apiRequestAuth(`${path}${qs(params)}`, { method: 'GET', signal })
}

export const endOfDayOrderApi = {
  getSummary: (filters, opts) =>
    get(
      `${ORDER_EOD}/summary`,
      pick(filters, [
        ...DATE_KEYS,
        'employeeId',
        'customerId',
        'channel',
        'paymentMethod',
        'salesMode',
        'orderStatus',
      ]),
      opts,
    ),

  getSales: (filters, opts) =>
    get(
      `${ORDER_EOD}/sales`,
      pick(filters, [
        ...DATE_KEYS,
        'employeeId',
        'customerId',
        'channel',
        'paymentMethod',
        'salesMode',
        'orderStatus',
        'page',
        'pageSize',
      ]),
      opts,
    ),

  // Endpoint thanh toán không nhận orderStatus vì lọc theo Payment, không theo trạng thái đơn.
  getPayments: (filters, opts) =>
    get(
      `${ORDER_EOD}/payments`,
      pick(filters, [
        ...DATE_KEYS,
        'employeeId',
        'customerId',
        'channel',
        'paymentMethod',
        'salesMode',
        'page',
        'pageSize',
      ]),
      opts,
    ),

  // Endpoint hàng hóa không nhận paymentMethod/orderStatus.
  getProducts: (filters, opts) =>
    get(
      `${ORDER_EOD}/products`,
      pick(filters, [...DATE_KEYS, 'employeeId', 'customerId', 'channel', 'salesMode', 'page', 'pageSize']),
      opts,
    ),

  // Ngoại lệ: đếm và tổng tiền do backend tính trên toàn kỳ, page/pageSize chỉ áp cho danh
  // sách đơn chưa thu đủ. Không nhận paymentMethod/orderStatus.
  getExceptions: (filters, opts) =>
    get(
      `${ORDER_EOD}/exceptions`,
      pick(filters, [...DATE_KEYS, 'employeeId', 'customerId', 'channel', 'salesMode', 'page', 'pageSize']),
      opts,
    ),
}

/** Trần một trang phía server. Gửi lớn hơn cũng bị cắt về đúng con số này. */
export const SERVER_MAX_PAGE_SIZE = 200

/**
 * Tải hết các trang của một endpoint danh sách, dùng cho xuất Excel và bản in — hai
 * đường này cần đủ dòng chứ không chỉ trang đang xem.
 *
 * Có trần `maxRows` để một kỳ bất thường không kéo hàng chục nghìn dòng vào bộ nhớ
 * trình duyệt. Khi chạm trần, `truncated = true` để nơi gọi ghi rõ trong file thay vì
 * lặng lẽ cắt bớt.
 */
export async function fetchAllPages(fetchPage, filters, { maxRows = 5000, signal } = {}) {
  const items = []
  let first = null
  let page = 1

  for (;;) {
    const res = await fetchPage({ ...filters, page, pageSize: SERVER_MAX_PAGE_SIZE }, { signal })
    if (page === 1) first = res
    const batch = res?.items || []
    items.push(...batch)

    const totalPages = res?.totalPages || 0
    if (batch.length === 0 || page >= totalPages || items.length >= maxRows) break
    page += 1
  }

  const totalCount = first?.totalCount || items.length
  return { ...(first || {}), items, truncated: items.length < totalCount }
}

export const endOfDayInventoryApi = {
  getSummary: (filters, opts) => get(`${INVENTORY_EOD}/summary`, pick(filters, [...DATE_KEYS, 'location']), opts),

  /** Chỉ endpoint này nhận queueStatus. */
  getQueues: (filters, opts) =>
    get(`${INVENTORY_EOD}/queues`, pick(filters, [...DATE_KEYS, 'queueStatus', 'page', 'pageSize']), opts),

  getTransfers: (filters, opts) =>
    get(`${INVENTORY_EOD}/transfers`, pick(filters, [...DATE_KEYS, 'location', 'page', 'pageSize']), opts),

  /** Không nhận location vì sản xuất luôn diễn ra ở Kho. */
  getCustomOrders: (filters, opts) =>
    get(`${INVENTORY_EOD}/custom-orders`, pick(filters, [...DATE_KEYS, 'page', 'pageSize']), opts),
}
