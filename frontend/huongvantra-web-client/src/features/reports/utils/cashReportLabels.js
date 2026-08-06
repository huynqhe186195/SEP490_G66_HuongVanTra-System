/** Nhãn tiếng Việt cho enum của báo cáo đối soát két. */

const PAYMENT_METHOD_LABELS = {
  Cash: 'Tiền mặt',
  VietQR: 'VietQR',
  BankTransfer: 'Chuyển khoản',
  COD: 'Thu hộ COD',
  Debt: 'Ghi nợ',
}

const PAYMENT_PURPOSE_LABELS = {
  Full: 'Thu đủ một lần',
  Deposit: 'Tiền cọc',
  RemainingAtPickup: 'Thu phần còn lại khi nhận hàng',
}

export function paymentMethodLabel(value) {
  if (!value) return '—'
  return PAYMENT_METHOD_LABELS[value] || value
}

export function paymentPurposeLabel(value) {
  if (!value) return '—'
  return PAYMENT_PURPOSE_LABELS[value] || value
}
