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
  const collectedAmount = getCollectedPaymentAmount(payment, order)
  const remainingDebt = Math.max(0, finalAmount - collectedAmount)
  const isFullyPaid = collectedAmount > 0 && remainingDebt <= 0
  const isCod = paymentMethod === 'COD'
  const isTransfer = paymentMethod === 'VietQR' || paymentMethod === 'BankTransfer'
  const isPosSale = orderChannel === 'POS' && !isCod
  const amountCaption =
    collectedAmount > 0 ? 'Đã thu' : isTransfer && paymentStatus === 'pending' ? 'Số tiền cần thu' : 'Số tiền'
  const displayAmount = collectedAmount > 0 ? collectedAmount : expectedAmount

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
      detail: expectedAmount > 0 ? `Chờ chuyển khoản ${formatVnd(expectedAmount)}` : null,
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
  const payment = getPrimaryPayment(order)
  if (!payment) return 0
  if (normalizeOrderKey(order?.orderStatus) !== 'Completed') return 0
  const finalAmount = Number(order?.finalAmount || 0)
  const collectedAmount = getCollectedPaymentAmount(payment, order)
  return Math.max(0, finalAmount - collectedAmount)
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

export function canReturnOrder(order) {
  if (!order || isExchangeOrder(order)) return false
  if (normalizeOrderKey(order.orderStatus) !== 'Completed') return false
  const lines = order.items || []
  return lines.some((line) => Number(line.returnedQuantity || 0) < Number(line.quantity || 0))
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
