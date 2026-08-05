export function formatVnd(amount) {
  const value = Number(amount) || 0
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value)
}

export function normalizeOrderKey(value) {
  return String(value || '').trim()
}

function normalizeLooseKey(value) {
  return normalizeOrderKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PendingPayment', label: 'Chờ thanh toán' },
  { value: 'Processing', label: 'Đang xử lý' },
  { value: 'WaitingTransfer', label: 'Chờ điều chuyển' },
  { value: 'WaitingProduction', label: 'Chờ sản xuất' },
  { value: 'WaitingMaterials', label: 'Chờ nguyên liệu' },
  { value: 'ReadyToDeliver', label: 'Sẵn sàng giao' },
  { value: 'Shipping', label: 'Đang giao' },
  { value: 'Completed', label: 'Hoàn tất' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

export const ORDER_CHANNEL_OPTIONS = [
  { value: '', label: 'Tất cả kênh' },
  { value: 'POS', label: 'Bán trực tiếp tại quầy' },
  { value: 'COD', label: 'COD (giao hàng thu tiền)' },
  { value: 'B2B', label: 'Doanh nghiệp (hợp đồng)' },
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
  const key = normalizeOrderKey(status).toLowerCase()
  const map = {
    draft: 'Nháp',
    pendingpayment: 'Chờ thanh toán',
    waitingmaterials: 'Chờ nguyên liệu',
    waitingtransfer: 'Chờ điều chuyển',
    waitingproduction: 'Chờ sản xuất',
    readytodeliver: 'Sẵn sàng giao',
    cancellationrequested: 'Chờ duyệt hủy/hoàn tiền',
    processing: 'Đang xử lý',
    shipping: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getOrderChannelLabel(channel) {
  const key = normalizeOrderKey(channel)
  const map = {
    POS: 'Bán tại quầy',
    COD: 'COD (giao hàng thu tiền)',
    B2B: 'Doanh nghiệp (hợp đồng)',
    Website: 'Website',
    Zalo: 'Zalo',
    Phone: 'Điện thoại',
  }
  return map[key] || channel || '—'
}

export function getOrderChannelClass(channel) {
  const key = normalizeLooseKey(channel)
  if (key === 'pos' || key.includes('bantaiquay') || key.includes('bantructieptaiquay')) {
    return 'border border-[#538463]/20 bg-[#538463]/10 text-[#356647]'
  }
  if (key === 'zalo') return 'border border-blue-200 bg-blue-50 text-blue-700'
  if (key === 'website') return 'border border-purple-200 bg-purple-50 text-purple-700'
  if (key === 'b2b' || key.includes('doanhnghiep') || key.includes('hopdong')) {
    return 'border border-indigo-200 bg-indigo-50 text-indigo-700'
  }
  if (key === 'phone' || key.includes('dienthoai')) {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  return 'border border-slate-200 bg-slate-100 text-slate-600'
}

export function getOrderKindLabel(kind) {
  const key = normalizeOrderKey(kind)
  const map = {
    Sale: 'Bán hàng',
    Exchange: 'Đổi hàng',
  }
  return map[key] || kind || '—'
}

export function isExchangeOrder(order) {
  return normalizeOrderKey(order?.orderKind) === 'Exchange'
}

export const EXCHANGE_CHANNEL_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'POS', label: 'Tại quầy' },
  { value: 'COD', label: 'COD giao hàng' },
]

export function getExchangeChannelBadgeClass(channel) {
  const key = normalizeOrderKey(channel)
  if (key === 'COD') return 'bg-amber-50 text-amber-800 border border-amber-200'
  if (key === 'POS') return 'bg-[#538463]/10 text-[#356647] border border-[#538463]/20'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

export function getExchangeChannelShortLabel(channel) {
  const key = normalizeOrderKey(channel)
  if (key === 'COD') return 'COD'
  if (key === 'POS') return 'Tại quầy'
  return getOrderChannelLabel(channel)
}

export function getPaymentMethodLabel(method) {
  const key = normalizeOrderKey(method)
  const map = {
    Cash: 'Tiền mặt',
    VietQR: 'VietQR',
    BankTransfer: 'Chuyển khoản',
    COD: 'COD',
    Debt: 'Ghi nợ hợp đồng',
  }
  return map[key] || method || '—'
}

export function getPaymentStatusLabel(status) {
  const key = normalizeOrderKey(status)
  const map = {
    Pending: 'Chờ xử lý',
    Success: 'Thành công',
    Failed: 'Thất bại',
    Deferred: 'Ghi nợ theo hợp đồng',
    Refunded: 'Đã hoàn tiền',
  }
  return map[key] || status || '—'
}

/** Số tiền thực sự đã thu — không dùng số tiền QR/chờ CK khi chưa Success. */
export function getCollectedPaymentAmount(payment, order = null) {
  if (!payment) return 0
  const paymentStatus = normalizeOrderKey(payment.paymentStatus).toLowerCase()
  const paymentMethod = normalizeOrderKey(payment.paymentMethod)
  const orderStatus = normalizeOrderKey(order?.orderStatus)
  const amount = Number(payment.amount || 0)
  if (amount <= 0) return 0

  if (paymentStatus === 'success' || payment.paidAt) return amount

  const isTransfer = paymentMethod === 'VietQR' || paymentMethod === 'BankTransfer'
  if (isTransfer) return 0

  if (orderStatus === 'Completed' && normalizeOrderKey(order?.orderChannel) === 'POS' && paymentMethod === 'Cash') {
    return amount
  }

  return 0
}

export function getCollectedOrderPaymentAmount(order) {
  return (order?.payments || []).reduce(
    (sum, payment) => sum + getCollectedPaymentAmount(payment, order),
    0,
  )
}

export function getOrderPaymentMethodLabel(order) {
  const labels = (order?.payments || [])
    .map((payment) => getPaymentMethodLabel(payment?.paymentMethod))
    .filter(Boolean)
  return [...new Set(labels)].join(' + ') || '—'
}

/** Hiển thị trạng thái thanh toán nhất quán với trạng thái đơn (tránh "Hoàn tất" nhưng "Chờ xử lý"). */
export function resolveOrderPaymentDisplay(order) {
  const payment = getPrimaryPayment(order)
  if (!payment) {
    return { label: '—', className: 'bg-slate-100 text-slate-600', detail: null, amountCaption: 'Số tiền', displayAmount: 0 }
  }

  const orderStatus = normalizeOrderKey(order?.orderStatus)
  const paymentStatus = normalizeOrderKey(payment.paymentStatus).toLowerCase()
  const paymentMethod = normalizeOrderKey(payment.paymentMethod)
  const orderChannel = normalizeOrderKey(order?.orderChannel)
  const finalAmount = Number(order?.finalAmount || 0)
  const expectedAmount = Number(payment.amount || 0)
  const collectedAmount = getCollectedOrderPaymentAmount(order)
  const remainingDebt = Math.max(0, finalAmount - collectedAmount)
  const isFullyPaid = collectedAmount > 0 && remainingDebt <= 0
  const isCod = paymentMethod === 'COD'
  const isTransfer = paymentMethod === 'VietQR' || paymentMethod === 'BankTransfer'
  const isPosSale = orderChannel === 'POS' && !isCod
  const amountCaption =
    collectedAmount > 0 ? 'Đã thu' : isTransfer && paymentStatus === 'pending' ? 'Số tiền cần thu' : 'Số tiền'
  const displayAmount = collectedAmount > 0 ? collectedAmount : expectedAmount

  if (normalizeOrderKey(order?.refundStatus) === 'Completed' || paymentStatus === 'refunded') {
    return {
      label: 'Đã hoàn tiền',
      className: getPaymentStatusClass('Refunded'),
      detail: order?.refundEvidence ? `Bằng chứng: ${order.refundEvidence}` : null,
      amountCaption: 'Đã hoàn',
      displayAmount: Number(order?.refundAmount || expectedAmount),
    }
  }

  if (orderStatus === 'Cancelled') {
    if (collectedAmount > 0) {
      return {
        label: 'Đã thanh toán trước khi hủy',
        className: getPaymentStatusClass('Success'),
        detail: `Đã thu ${formatVnd(collectedAmount)}`,
        amountCaption: 'Đã thu',
        displayAmount: collectedAmount,
      }
    }

    return {
      label: 'Chưa thanh toán',
      className: 'bg-slate-100 text-slate-600',
      detail:
        isTransfer && expectedAmount > 0
          ? `Đơn đã hủy · VietQR ${formatVnd(expectedAmount)} chưa được xác nhận`
          : 'Đơn đã hủy',
      amountCaption: isTransfer && expectedAmount > 0 ? 'Số tiền QR' : 'Số tiền',
      displayAmount: expectedAmount,
    }
  }

  if (orderStatus === 'Completed') {
    if (isCod) {
      return {
        label: payment.isCodVerified ? 'Đã thanh toán' : 'COD chưa xác nhận',
        className: payment.isCodVerified ? getPaymentStatusClass('Success') : 'bg-amber-50 text-amber-800',
        detail: null,
        amountCaption: payment.isCodVerified ? 'Đã thu' : 'Số tiền COD',
        displayAmount: payment.isCodVerified ? collectedAmount || expectedAmount : expectedAmount,
      }
    }

    if (collectedAmount > 0) {
      if (!isFullyPaid) {
        return {
          label: 'Đã thu một phần',
          className: 'bg-amber-50 text-amber-800',
          detail: `Đã thu ${formatVnd(collectedAmount)} · Còn nợ ${formatVnd(remainingDebt)}`,
          amountCaption: 'Đã thu',
          displayAmount: collectedAmount,
        }
      }

      return {
        label: 'Đã thanh toán',
        className: getPaymentStatusClass('Success'),
        detail: null,
        amountCaption: 'Đã thu',
        displayAmount: collectedAmount,
      }
    }

    if (finalAmount > 0) {
      return {
        label: 'Mua chịu',
        className: 'bg-amber-50 text-amber-800',
        detail: `Còn nợ ${formatVnd(finalAmount)}`,
        amountCaption: 'Số tiền',
        displayAmount: finalAmount,
      }
    }
  }

  if (paymentStatus === 'pending' && isTransfer) {
    return {
      label: 'Chờ thanh toán',
      className: 'bg-amber-50 text-amber-800',
      detail: expectedAmount > 0
        ? collectedAmount > 0
          ? `Đã thu ${formatVnd(collectedAmount)} · Chờ chuyển khoản ${formatVnd(expectedAmount)}`
          : `Chờ chuyển khoản ${formatVnd(expectedAmount)}`
        : null,
      amountCaption: 'Số tiền cần thu',
      displayAmount: expectedAmount,
    }
  }

  if (orderStatus === 'PendingPayment' && isPosSale && collectedAmount <= 0 && expectedAmount > 0 && !isTransfer) {
    return {
      label: 'Chờ thanh toán',
      className: getPaymentStatusClass('Pending'),
      detail: null,
      amountCaption: 'Số tiền',
      displayAmount: expectedAmount,
    }
  }

  return {
    label: getPaymentStatusLabel(payment.paymentStatus),
    className: getPaymentStatusClass(payment.paymentStatus),
    detail: null,
    amountCaption: collectedAmount > 0 ? 'Đã thu' : 'Số tiền',
    displayAmount: collectedAmount > 0 ? collectedAmount : expectedAmount,
  }
}

export function getOrderRemainingDebt(order) {
  if (!(order?.payments || []).length) return 0
  if (normalizeOrderKey(order?.orderStatus) !== 'Completed') return 0
  const finalAmount = Number(order?.finalAmount || 0)
  const collectedAmount = getCollectedOrderPaymentAmount(order)
  return Math.max(0, finalAmount - collectedAmount)
}

export function getInventorySyncLabel(status) {
  const key = normalizeOrderKey(status)
  if (key === 'PendingReconciliation') return 'Chờ đối soát nguyên liệu'
  const map = {
    Synced: 'Đã đồng bộ kho',
    PendingDeduction: 'Chờ trừ tồn quầy',
    Cancelled: 'Không trừ tồn quầy (đã hủy)',
  }
  return map[key] || status || '—'
}

export function getRefundStatusLabel(status) {
  const map = {
    NotRequired: 'Không cần hoàn tiền',
    PendingApproval: 'Chờ Quản lý duyệt',
    Approved: 'Đã duyệt, chờ hoàn tiền',
    Completed: 'Đã hoàn tiền',
    Rejected: 'Từ chối hoàn tiền',
  }
  return map[normalizeOrderKey(status)] || 'Không cần hoàn tiền'
}

export function resolveInventorySyncMeta(order) {
  const orderStatus = normalizeOrderKey(order?.orderStatus)
  const syncStatus = normalizeOrderKey(order?.inventorySyncStatus)

  if (orderStatus === 'Cancelled' || syncStatus === 'Cancelled') {
    return {
      label: 'Không trừ tồn quầy (đã hủy)',
      className: 'bg-slate-100 text-slate-500',
    }
  }

  return {
    label: getInventorySyncLabel(order?.inventorySyncStatus),
    className: getInventorySyncClass(order?.inventorySyncStatus),
  }
}

export function getOrderStatusClass(status) {
  const key = normalizeLooseKey(status)
  if (key === 'completed' || key.includes('hoantat')) {
    return 'text-emerald-700 bg-emerald-100 border border-emerald-300'
  }
  if (key === 'cancelled' || key.includes('dahuy')) {
    return 'text-red-700 bg-red-100 border border-red-300'
  }
  if (key === 'shipping' || key.includes('danggiao')) {
    return 'text-orange-700 bg-orange-100 border border-orange-300'
  }
  if (key === 'processing' || key.includes('dangxuly')) {
    return 'text-blue-700 bg-blue-100 border border-blue-300'
  }
  if (key === 'pendingpayment' || key.includes('chothanhtoan')) {
    return 'text-amber-700 bg-amber-100 border border-amber-300'
  }
  if (key === 'waitingmaterials') {
    return 'text-violet-700 bg-violet-100 border border-violet-300'
  }
  if (key === 'waitingtransfer' || key === 'waitingproduction') {
    return 'text-indigo-700 bg-indigo-100 border border-indigo-300'
  }
  if (key === 'readytodeliver') {
    return 'text-teal-700 bg-teal-100 border border-teal-300'
  }
  if (key === 'cancellationrequested') {
    return 'text-rose-700 bg-rose-100 border border-rose-300'
  }
  return 'border border-slate-200 bg-slate-100 text-slate-600'
}

export function getPaymentStatusClass(status) {
  const key = normalizeOrderKey(status)
  if (key === 'Success') return 'bg-emerald-50 text-emerald-700'
  if (key === 'Failed') return 'bg-red-50 text-red-600'
  if (key === 'Deferred') return 'bg-indigo-50 text-indigo-700'
  if (key === 'Refunded') return 'bg-violet-50 text-violet-700'
  return 'bg-amber-50 text-amber-700'
}

export function getInventorySyncClass(status) {
  const key = normalizeOrderKey(status)
  if (key === 'Synced') return 'bg-emerald-50 text-emerald-700'
  if (key === 'PendingReconciliation') return 'bg-amber-50 text-amber-700'
  if (key === 'Cancelled') return 'bg-slate-100 text-slate-500'
  return 'bg-slate-100 text-slate-600'
}

export function isCodOrder(order) {
  return Boolean(order?.payments?.some(
    (payment) => normalizeOrderKey(payment?.paymentMethod) === 'COD',
  ))
}

export function isOrderTerminal(order) {
  const status = normalizeOrderKey(order?.orderStatus)
  return status === 'Completed' || status === 'Cancelled'
}

export function canReturnOrder(order) {
  if (!order || isExchangeOrder(order)) return false
  if (normalizeOrderKey(order.orderStatus) !== 'Completed') return false
  const lines = order.items || []
  return lines.some((line) => Number(line.returnedQuantity || 0) < Number(line.quantity || 0))
}

export function canReprintReceipt(order) {
  return normalizeOrderKey(order?.orderStatus) === 'Completed'
}

export function getManualDiscountAmount(order) {
  const total = Number(order?.discountAmount ?? 0)
  const promotion = Number(order?.promotionDiscountAmount ?? 0)
  return Math.max(0, total - promotion)
}

const BACKORDER_REFUND_GUARDED_STATUSES = new Set([
  'WaitingMaterials',
  'WaitingTransfer',
  'WaitingProduction',
  'ReadyToDeliver',
])

export function canEditOrderMeta(order) {
  const status = normalizeOrderKey(order?.orderStatus)
  return Boolean(
    order
    && !isOrderTerminal(order)
    && !BACKORDER_REFUND_GUARDED_STATUSES.has(status)
    && status !== 'CancellationRequested'
  )
}

export function getOrderEditBlockedMessage(order) {
  if (!order) return ''
  const status = getOrderStatusLabel(order.orderStatus)
  return `Đơn đang ở trạng thái "${status}" nên không thể sửa địa chỉ, giảm giá hay khuyến mãi. Chỉ sửa được khi đơn chờ thanh toán, đang xử lý hoặc đang giao.`
}

export function isTransferPaymentMethod(method) {
  const key = normalizeOrderKey(method)
  return key === 'VietQR' || key === 'BankTransfer'
}

export function isPendingPaymentOrder(order) {
  return normalizeOrderKey(order?.orderStatus) === 'PendingPayment'
}

export function isPendingTransferPayment(order) {
  const payment = order?.payments?.find(
    (row) => isTransferPaymentMethod(row?.paymentMethod),
  )
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
  if (isContractOrder(order)) {
    const contractStatus = normalizeOrderKey(order?.orderStatus)
    return contractStatus === 'PendingPayment' || contractStatus === 'Processing'
  }
  if (!requiresDelivery(order)) return false
  if (isPendingTransferPayment(order)) return false
  const status = normalizeOrderKey(order?.orderStatus)
  return status === 'PendingPayment' || status === 'Processing'
}

export function canCompleteOrder(order) {
  const status = normalizeOrderKey(order?.orderStatus)
  if (status === 'Cancelled' || status === 'Completed'
    || status === 'WaitingMaterials' || status === 'CancellationRequested'
    // POS-06: 3 trạng thái chờ mới do Thủ kho/Sale đẩy tiếp, không cho hoàn tất thủ công.
    || status === 'WaitingTransfer' || status === 'WaitingProduction'
    || status === 'ReadyToDeliver') return false
  // Đơn hợp đồng bắt buộc qua bước kho xác nhận xuất hàng trước khi ghi nợ.
  if (isContractOrder(order) && status !== 'Shipping') return false
  if (isPendingTransferPayment(order)) return false
  if (canVerifyCod(order)) return false
  return true
}

// POS-06 (KB4): đơn đã đủ hàng, chờ Sale xác nhận khách quay lại lấy.
export function canMarkDelivered(order) {
  return normalizeOrderKey(order?.orderStatus) === 'ReadyToDeliver'
}

// POS-06 (KB4): cảnh báo hạn giao dựa trên ngày hẹn; không tự động hủy đơn.
export function getPickupDueBadge(order) {
  if (!canMarkDelivered(order) || !order?.pickupDate) return null
  const due = new Date(order.pickupDate)
  if (Number.isNaN(due.getTime())) return null
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due - today) / 86400000)
  if (diffDays > 0) return null
  return diffDays === 0
    ? { label: 'Hôm nay cần giao', className: 'text-amber-700 bg-amber-100 border border-amber-300' }
    : { label: 'Quá hạn giao', className: 'text-red-700 bg-red-100 border border-red-300' }
}

export function isContractOrder(order) {
  return normalizeOrderKey(order?.orderChannel) === 'B2B' || Boolean(order?.contractId)
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
  const payments = order?.payments || []
  return payments.find((payment) =>
    isTransferPaymentMethod(payment?.paymentMethod)
    && normalizeOrderKey(payment?.paymentStatus) !== 'Success')
    || payments.find((payment) => normalizeOrderKey(payment?.paymentMethod) === 'COD')
    || payments.at(0)
    || null
}

export function getCodDaysPending(order) {
  const createdAt = order?.createdAt
  if (createdAt) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000))
    return Math.max(0, days)
  }

  if (!order?.codWarningDate) return 0
  const warning = new Date(order.codWarningDate)
  const createdOffset = warning.getTime() - 7 * 24 * 60 * 60 * 1000
  const days = Math.floor((Date.now() - createdOffset) / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

export function isCodOverdue(order) {
  if (!order) return false
  const payment = order?.payments?.find((row) => normalizeOrderKey(row.paymentMethod) === 'COD')
  const isUnverifiedCod = payment ? !payment.isCodVerified : order?.codWarningDate != null
  if (!isUnverifiedCod) return false
  return getCodDaysPending(order) >= 7
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
  { value: 'pending_deduct', label: 'Chờ trừ tồn quầy' },
  { value: 'deducted', label: 'Đã trừ tồn quầy' },
  { value: 'waiting_stock', label: 'Chờ hàng' },
  { value: 'cancelled', label: 'Đã hủy (kho)' },
]

export function getStockStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'pendingreconciliation' || key === 'pending_bom_reconciliation') return 'Chờ đối soát nguyên liệu'
  if (key === 'waiting_materials') return 'Chờ nguyên liệu'
  const map = {
    pending_deduct: 'Chờ trừ tồn quầy',
    pendingdeduction: 'Chờ trừ tồn quầy',
    pending_warehouse_transfer: 'Chờ điều chuyển từ Kho',
    deducted: 'Đã trừ tồn quầy',
    synced: 'Đã trừ tồn quầy',
    restored: 'Đã hoàn tồn',
    waiting_stock: 'Chờ hàng',
    cancelled: 'Đã hủy',
    cancelled_after_shipping: 'Đã hủy sau khi giao',
  }
  return map[key] || status || '—'
}

export function getQueueStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    waiting: 'Chờ xác nhận',
    insufficient: 'Chờ hàng',
    confirmed: 'Đã trừ',
    cancelled: 'Đã hủy',
  }
  return map[key] || status || '—'
}

export function getStockStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'deducted' || key === 'synced') return 'bg-[#b9d4b0]/30 text-[#538463]'
  if (key === 'pending_bom_reconciliation' || key === 'waiting_materials') return 'bg-amber-50 text-amber-700'
  if (key === 'waiting_stock' || key === 'insufficient') return 'bg-amber-50 text-amber-700'
  if (key === 'pending_warehouse_transfer') return 'bg-sky-50 text-sky-700'
  if (key === 'restored') return 'bg-slate-100 text-slate-600'
  if (key === 'cancelled' || key === 'cancelled_after_shipping') return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}
