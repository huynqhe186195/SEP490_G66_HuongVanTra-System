export function formatVnd(amount) {
  const value = Number(amount) || 0
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value)
}

export function normalizeOrderKey(value) {
  return String(value || '').trim()
}

export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PendingPayment', label: 'Chờ thanh toán' },
  { value: 'Processing', label: 'Đang xử lý' },
  { value: 'Shipping', label: 'Đang giao' },
  { value: 'Completed', label: 'Hoàn tất' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

export const ORDER_CHANNEL_OPTIONS = [
  { value: '', label: 'Tất cả kênh' },
  { value: 'POS', label: 'Bán trực tiếp tại quầy' },
  { value: 'COD', label: 'COD (giao hàng thu tiền)' },
  { value: 'Website', label: 'Website' },
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Phone', label: 'Điện thoại' },
]

export const ORDER_CHANNEL_CREATE_OPTIONS = [
  { value: 'POS', label: 'Bán trực tiếp tại quầy' },
  { value: 'Phone', label: 'Điện thoại' },
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Website', label: 'Website' },
]

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Tiền mặt' },
  { value: 'VietQR', label: 'VietQR' },
  { value: 'BankTransfer', label: 'Chuyển khoản' },
  { value: 'COD', label: 'COD (thu hộ)' },
]

export function getOrderStatusLabel(status) {
  const key = normalizeOrderKey(status)
  const map = {
    Draft: 'Nháp',
    PendingPayment: 'Chờ thanh toán',
    Processing: 'Đang xử lý',
    Shipping: 'Đang giao',
    Completed: 'Hoàn tất',
    Cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getOrderChannelLabel(channel) {
  const key = normalizeOrderKey(channel)
  const map = {
    POS: 'Bán trực tiếp tại quầy',
    COD: 'COD (giao hàng thu tiền)',
    Website: 'Website',
    Zalo: 'Zalo',
    Phone: 'Điện thoại',
  }
  return map[key] || channel || '—'
}

export function getPaymentMethodLabel(method) {
  const key = normalizeOrderKey(method)
  const map = {
    Cash: 'Tiền mặt',
    VietQR: 'VietQR',
    BankTransfer: 'Chuyển khoản',
    COD: 'COD',
  }
  return map[key] || method || '—'
}

export function getPaymentStatusLabel(status) {
  const key = normalizeOrderKey(status)
  const map = {
    Pending: 'Chờ xử lý',
    Success: 'Thành công',
    Failed: 'Thất bại',
  }
  return map[key] || status || '—'
}

export function getInventorySyncLabel(status) {
  const key = normalizeOrderKey(status)
  const map = {
    Synced: 'Đã đồng bộ kho',
    PendingDeduction: 'Chờ trừ kho',
    Cancelled: 'Không trừ kho (đã hủy)',
  }
  return map[key] || status || '—'
}

export function resolveInventorySyncMeta(order) {
  const orderStatus = normalizeOrderKey(order?.orderStatus)
  const syncStatus = normalizeOrderKey(order?.inventorySyncStatus)

  if (orderStatus === 'Cancelled' || syncStatus === 'Cancelled') {
    return {
      label: 'Không trừ kho (đã hủy)',
      className: 'bg-slate-100 text-slate-500',
    }
  }

  return {
    label: getInventorySyncLabel(order?.inventorySyncStatus),
    className: getInventorySyncClass(order?.inventorySyncStatus),
  }
}

export function getOrderStatusClass(status) {
  const key = normalizeOrderKey(status)
  if (key === 'Completed') return 'bg-emerald-50 text-emerald-700'
  if (key === 'Cancelled') return 'bg-red-50 text-red-600'
  if (key === 'Shipping' || key === 'Processing') return 'bg-blue-50 text-blue-700'
  if (key === 'PendingPayment') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

export function getPaymentStatusClass(status) {
  const key = normalizeOrderKey(status)
  if (key === 'Success') return 'bg-emerald-50 text-emerald-700'
  if (key === 'Failed') return 'bg-red-50 text-red-600'
  return 'bg-amber-50 text-amber-700'
}

export function getInventorySyncClass(status) {
  const key = normalizeOrderKey(status)
  if (key === 'Synced') return 'bg-emerald-50 text-emerald-700'
  if (key === 'Cancelled') return 'bg-slate-100 text-slate-500'
  return 'bg-slate-100 text-slate-600'
}

export function isCodOrder(order) {
  const payment = order?.payments?.[0]
  return normalizeOrderKey(payment?.paymentMethod) === 'COD'
}

export function isOrderTerminal(order) {
  const status = normalizeOrderKey(order?.orderStatus)
  return status === 'Completed' || status === 'Cancelled'
}

export function canEditOrderMeta(order) {
  return Boolean(order && !isOrderTerminal(order))
}

export function isTransferPaymentMethod(method) {
  const key = normalizeOrderKey(method)
  return key === 'VietQR' || key === 'BankTransfer'
}

export function isPendingPaymentOrder(order) {
  return normalizeOrderKey(order?.orderStatus) === 'PendingPayment'
}

export function isPendingTransferPayment(order) {
  const payment = getPrimaryPayment(order)
  const orderStatus = normalizeOrderKey(order?.orderStatus)
  const paymentStatus = normalizeOrderKey(payment?.paymentStatus)
  return (
    orderStatus === 'PendingPayment'
    && isTransferPaymentMethod(payment?.paymentMethod)
    && paymentStatus !== 'Success'
  )
}

export function requiresDelivery(order) {
  if (isPosChannel(order?.orderChannel)) return false
  const channel = normalizeOrderKey(order?.orderChannel)
  return requiresShippingAddress(channel) || Boolean(String(order?.shippingAddress || '').trim())
}

export function canShipOrder(order) {
  if (!requiresDelivery(order)) return false
  if (isPendingTransferPayment(order)) return false
  const status = normalizeOrderKey(order?.orderStatus)
  return status === 'PendingPayment' || status === 'Processing'
}

export function canCompleteOrder(order) {
  const status = normalizeOrderKey(order?.orderStatus)
  if (status === 'Cancelled' || status === 'Completed') return false
  if (isPendingTransferPayment(order)) return false
  if (canVerifyCod(order)) return false
  return true
}

export function isCodChannelOrder(order) {
  return normalizeOrderKey(order?.orderChannel) === 'COD'
}

export function canCancelOrder(order) {
  return canEditOrderMeta(order)
}

export function canVerifyCod(order) {
  const payment = order?.payments?.find((row) => normalizeOrderKey(row.paymentMethod) === 'COD')
  return Boolean(payment && !payment.isCodVerified)
}

export function getPrimaryPayment(order) {
  return order?.payments?.[0] || null
}

export function getCodDaysPending(payment) {
  if (!payment?.codWarningDate) return 0
  const warning = new Date(payment.codWarningDate)
  const createdOffset = warning.getTime() - 7 * 24 * 60 * 60 * 1000
  const days = Math.floor((Date.now() - createdOffset) / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

export function isCodOverdue(payment) {
  if (!payment?.codWarningDate) return false
  return new Date(payment.codWarningDate).getTime() <= Date.now()
}

export function requiresShippingAddress(channel) {
  const key = normalizeOrderKey(channel)
  return key === 'Website' || key === 'Zalo' || key === 'Phone' || key === 'COD'
}

export function isPosChannel(channel) {
  return normalizeOrderKey(channel) === 'POS'
}

export function getCreateOrderPaymentOptions(channel) {
  if (isPosChannel(channel)) {
    return PAYMENT_METHOD_OPTIONS.filter((opt) => opt.value !== 'COD')
  }
  return PAYMENT_METHOD_OPTIONS
}

export function calcOrderLineSubtotal(lines = []) {
  return lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
}

export function calcOrderFinalAmount(lines = [], discountAmount = 0) {
  return Math.max(0, calcOrderLineSubtotal(lines) - Number(discountAmount || 0))
}

// Legacy helpers still used by inventory stock-deduct pages
export const STOCK_STATUS_OPTIONS = [
  { value: 'pending_deduct', label: 'Chờ trừ kho' },
  { value: 'deducted', label: 'Đã trừ kho' },
  { value: 'waiting_stock', label: 'Chờ hàng' },
  { value: 'cancelled', label: 'Đã hủy (kho)' },
]

export function getStockStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    pending_deduct: 'Chờ trừ kho',
    pendingdeduction: 'Chờ trừ kho',
    deducted: 'Đã trừ kho',
    synced: 'Đã trừ kho',
    waiting_stock: 'Chờ hàng',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getQueueStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    waiting: 'Chờ trừ',
    insufficient: 'Thiếu hàng',
    confirmed: 'Đã trừ',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getStockStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'deducted' || key === 'synced') return 'bg-[#b9d4b0]/30 text-[#538463]'
  if (key === 'waiting_stock' || key === 'insufficient') return 'bg-amber-50 text-amber-700'
  if (key === 'cancelled') return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}
