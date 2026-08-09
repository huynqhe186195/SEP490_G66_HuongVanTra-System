/** Placeholder gán khi tạo/import KH chưa có địa chỉ thật — không dùng làm địa chỉ COD. */
export const PLACEHOLDER_SHIPPING_ADDRESS = 'Chưa có địa chỉ giao hàng'

export function normalizeShippingAddress(value) {
  return String(value || '').trim()
}

export function isPlaceholderShippingAddress(value) {
  const text = normalizeShippingAddress(value)
  if (!text) return false
  return text.localeCompare(PLACEHOLDER_SHIPPING_ADDRESS, 'vi', { sensitivity: 'accent' }) === 0
}

/** True khi trống hoặc đúng chuỗi placeholder CRM. */
export function isMissingOrPlaceholderShippingAddress(value) {
  const text = normalizeShippingAddress(value)
  if (!text) return true
  return isPlaceholderShippingAddress(text)
}

export function isUsableShippingAddress(value) {
  return !isMissingOrPlaceholderShippingAddress(value)
}
