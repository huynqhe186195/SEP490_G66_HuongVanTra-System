export function formatVnd(amount) {
  const value = Number(amount) || 0
  return `${value.toLocaleString('vi-VN')} đ`
}

export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái đơn' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'packing', label: 'Đóng gói' },
  { value: 'shipping', label: 'Đang giao' },
]

export const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả thanh toán' },
  { value: 'unpaid', label: 'Chưa thu' },
  { value: 'pending_payment', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thu' },
  { value: 'partial', label: 'Thu một phần' },
]

export const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Tất cả PT thanh toán' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
  { value: 'VIETQR', label: 'VietQR' },
  { value: 'COD', label: 'COD' },
]

export const STOCK_STATUS_OPTIONS = [
  { value: 'pending_deduct', label: 'Chờ trừ kho' },
  { value: 'deducted', label: 'Đã trừ kho' },
  { value: 'waiting_stock', label: 'Chờ hàng' },
  { value: 'cancelled', label: 'Đã hủy (kho)' },
]

export function getOrderStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    confirmed: 'Đã xác nhận',
    pending: 'Chờ xử lý',
    packing: 'Đóng gói',
    shipping: 'Đang giao',
    processing: 'Đang xử lý',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getPaymentStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    unpaid: 'Chưa thu',
    pending_payment: 'Chờ thanh toán',
    partial: 'Thu một phần',
    paid: 'Đã thu',
  }
  return map[key] || status || '—'
}

export function getPaymentMethodLabel(method) {
  const key = String(method || '').toUpperCase()
  const map = {
    CASH: 'Tiền mặt',
    TRANSFER: 'Chuyển khoản',
    VIETQR: 'VietQR',
    COD: 'COD',
  }
  return map[key] || method || '—'
}

export function getStockStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    pending_deduct: 'Chờ trừ kho',
    deducted: 'Đã trừ kho',
    waiting_stock: 'Chờ hàng',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getOrderChannelLabel(orderCode) {
  const code = String(orderCode || '').toUpperCase()
  if (code.startsWith('POS-')) return 'POS tại quầy'
  if (code.startsWith('ONL-')) return 'Online / mang đi'
  return 'Khác'
}

export function getOrderStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'completed') return 'bg-[#b9d4b0]/30 text-[#538463]'
  if (key === 'cancelled') return 'bg-red-50 text-red-600'
  if (key === 'processing' || key === 'confirmed') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

export function getPaymentStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'paid') return 'bg-[#b9d4b0]/30 text-[#538463]'
  if (key === 'partial') return 'bg-blue-50 text-blue-600'
  return 'bg-amber-50 text-amber-700'
}

export function isCodOrder(order) {
  const method = String(order?.paymentMethod || order?.payments?.[0]?.paymentMethod || '').toUpperCase()
  return method === 'COD'
}

export function canConfirmCod(order) {
  if (!isCodOrder(order)) return false
  const payment = String(order?.paymentStatus || '').toLowerCase()
  const orderStatus = String(order?.orderStatus || '').toLowerCase()
  return payment !== 'paid' && orderStatus !== 'cancelled' && orderStatus !== 'completed'
}

export function canEditOrderItems(order) {
  if (!order) return false
  const payment = String(order.paymentStatus || '').toLowerCase()
  const orderStatus = String(order.orderStatus || '').toLowerCase()
  if (payment === 'paid') return false
  if (orderStatus === 'cancelled' || orderStatus === 'completed') return false
  return true
}
