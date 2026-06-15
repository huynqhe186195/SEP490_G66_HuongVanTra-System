import { getCollectedPaymentAmount } from './orderDisplay.js'

/** Tổng tiền khách thực sự đã trả khi mua đơn này. */
export function getOrderCollectedAmount(order) {
  const payments = Array.isArray(order?.payments) ? order.payments : []
  const collected = payments.reduce(
    (sum, payment) => sum + getCollectedPaymentAmount(payment, order),
    0,
  )
  if (collected > 0) return collected

  const finalAmount = Number(order?.finalAmount ?? 0)
  if (finalAmount > 0) return finalAmount

  return Number(order?.totalAmount ?? 0)
}

/** Tỷ lệ tiền thực thu / tổng giá niêm yết trên hóa đơn. */
export function getOrderPaidRatio(order) {
  const totalAmount = Number(order?.totalAmount ?? 0)
  if (totalAmount <= 0) return 1
  const collected = getOrderCollectedAmount(order)
  const ratio = collected / totalAmount
  return ratio > 0 ? Math.min(ratio, 1) : 1
}
export function calcMembershipDiscountAmount(subtotal, tierDiscountPercent) {
  const percent = Number(tierDiscountPercent) || 0
  if (percent <= 0) return 0
  return Math.round((Number(subtotal) || 0) * percent / 100)
}

export function getReturnUnitPrice(listUnitPrice, paidRatio) {
  return Math.round((Number(listUnitPrice) || 0) * paidRatio)
}

export function calcReturnLineAmount(listUnitPrice, quantity, paidRatio) {
  const qty = Math.max(0, Number(quantity) || 0)
  return getReturnUnitPrice(listUnitPrice, paidRatio) * qty
}
