// Nguồn duy nhất cho nhãn tiếng Việt của Yêu cầu bổ sung Kệ Hàng và Phiếu điều chuyển Kho → Kệ.
// Không hiển thị enum tiếng Anh thô ra giao diện; giá trị lạ luôn rơi về "Không xác định".

import { isPersonalProductSkuCode, PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'

const UNKNOWN_LABEL = 'Không xác định'
const NEUTRAL_CLASS = 'bg-slate-100 text-slate-600'

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

const REQUEST_STATUS_LABELS = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  approved: 'Đã duyệt',
  processing: 'Đang xử lý',
  partiallyfulfilled: 'Đã bổ sung một phần',
  fulfilled: 'Đã bổ sung đủ',
  completed: 'Đã bổ sung đủ',
  rejected: 'Đã từ chối',
  closedpartial: 'Đã đóng phần còn lại',
  cancelled: 'Đã hủy',
}

const REQUEST_LINE_STATUS_LABELS = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  waitingforstock: 'Chờ bổ sung tồn Kho',
  partiallyfulfilled: 'Đã bổ sung một phần',
  fulfilled: 'Đã bổ sung đủ',
  rejected: 'Đã từ chối',
  closedpartial: 'Đã đóng phần còn lại',
  cancelled: 'Đã hủy',
}

const TRANSFER_STATUS_LABELS = {
  draft: 'Nháp',
  completed: 'Đã hoàn tất điều chuyển',
  cancelled: 'Đã hủy',
}

const STATUS_CLASSES = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-800',
  processing: 'bg-sky-100 text-sky-800',
  waitingforstock: 'bg-amber-100 text-amber-800',
  partiallyfulfilled: 'bg-indigo-100 text-indigo-800',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  closedpartial: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-600',
}

export function getStockRequestStatusLabel(status) {
  return REQUEST_STATUS_LABELS[normalize(status)] ?? UNKNOWN_LABEL
}

export function getStockRequestLineStatusLabel(status) {
  return REQUEST_LINE_STATUS_LABELS[normalize(status)] ?? UNKNOWN_LABEL
}

export function getStockTransferStatusLabel(status) {
  return TRANSFER_STATUS_LABELS[normalize(status)] ?? UNKNOWN_LABEL
}

export function getStockFlowStatusClass(status) {
  return STATUS_CLASSES[normalize(status)] ?? NEUTRAL_CLASS
}

/**
 * Tùy chọn trạng thái cho bộ lọc. Giá trị gửi lên API giữ đúng tên enum của backend
 * (Enum.TryParse không phân biệt hoa thường); nhãn hiển thị luôn là tiếng Việt.
 */
export const STOCK_REQUEST_STATUS_OPTIONS = [
  'Draft',
  'Pending',
  'Approved',
  'Processing',
  'PartiallyFulfilled',
  'Fulfilled',
  'Completed',
  'Rejected',
  'ClosedPartial',
  'Cancelled',
].map((value) => ({ value, label: getStockRequestStatusLabel(value) }))

/** Nhãn cột dùng chung để hai màn hình không lệch thuật ngữ. */
export const STOCK_FLOW_TERMS = {
  request: 'Yêu cầu bổ sung Kệ Hàng',
  transfer: 'Phiếu điều chuyển Kho → Kệ',
  requestedQuantity: 'Số lượng yêu cầu',
  approvedQuantity: 'Số lượng duyệt',
  fulfilledQuantity: 'Số lượng đã chuyển',
  rejectedQuantity: 'Số lượng từ chối',
  remainingQuantity: 'Số lượng còn lại',
  transferQuantity: 'Số lượng điều chuyển',
  warehouse: 'Kho',
  shelf: 'Kệ Hàng',
}

export function getStockTransferTypeLabel(transfer) {
  if (!transfer || typeof transfer !== 'object') return '—'

  const lines = transfer.lines ?? []
  const isPersonalProductTransfer = lines.some((line) => isPersonalProductSkuCode(line.skuCode))
    || String(transfer.note || '').toLowerCase().includes('sản phẩm cá nhân')

  if (transfer.sourceOrderId && isPersonalProductTransfer) {
    return PERSONAL_PRODUCT_LABEL
  }
  if (transfer.sourceOrderId) {
    const channel = String(transfer.sourceOrderChannel || '').trim().toUpperCase()
    if (channel === 'POS') return 'Đơn hàng POS'
    if (channel === 'COD') return 'Đơn hàng COD'
    if (channel) return `Đơn hàng ${channel}`
    return 'Đơn hàng bán'
  }
  if (transfer.sourceRequestId) return 'Yêu cầu bổ sung'
  if (transfer.sourceSuggestionId) return 'Từ gợi ý'
  return 'Không có nguồn (cũ)'
}

export function getStockTransferSourceRef(transfer) {
  if (!transfer || typeof transfer !== 'object') return '—'
  return transfer.sourceOrderCode
    || transfer.sourceRequestCode
    || transfer.sourceSuggestionCode
    || '—'
}

/**
 * Chuyển lỗi API thành thông điệp tiếng Việt.
 * Lỗi nghiệp vụ (4xx) đã có message tiếng Việt từ backend nên giữ nguyên;
 * lỗi hệ thống (5xx, mất mạng) trả về câu tiếng Việt kèm gợi ý xử lý.
 */
export function getStockFlowErrorMessage(error, fallback = 'Không thực hiện được thao tác. Vui lòng thử lại.') {
  const statusCode = Number(error?.statusCode ?? 0)
  const message = String(error?.message ?? '').trim()
  if (statusCode >= 400 && statusCode < 500 && message) return message
  if (statusCode >= 500) {
    return 'Hệ thống gặp sự cố khi xử lý yêu cầu. Dữ liệu chưa thay đổi. Vui lòng thử lại hoặc báo quản trị viên.'
  }
  if (!statusCode) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng rồi thử lại.'
  }
  return message || fallback
}
