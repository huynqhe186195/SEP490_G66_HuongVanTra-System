export const PRODUCT_TYPE = {
  THANH_PHAM: 'THANH_PHAM',
  NGUYEN_LIEU: 'NGUYEN_LIEU',
  BAO_BI: 'BAO_BI',
}

export const PRODUCT_TYPE_OPTIONS = [
  { value: PRODUCT_TYPE.THANH_PHAM, label: 'Sản phẩm kệ' },
  { value: PRODUCT_TYPE.NGUYEN_LIEU, label: 'Nguyên liệu' },
  { value: PRODUCT_TYPE.BAO_BI, label: 'Bao bì' },
]

export function getProductTypeLabel(value) {
  return PRODUCT_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '—'
}

export function getProductTypeTone(value) {
  if (value === PRODUCT_TYPE.THANH_PHAM) return 'green'
  if (value === PRODUCT_TYPE.NGUYEN_LIEU) return 'amber'
  if (value === PRODUCT_TYPE.BAO_BI) return 'blue'
  return 'neutral'
}

export function getProductSkuPrefix(value) {
  if (value === PRODUCT_TYPE.NGUYEN_LIEU) return 'RM'
  if (value === PRODUCT_TYPE.BAO_BI) return 'PKG'
  return 'FG'
}

export function getDefaultSellableByType(value) {
  return value === PRODUCT_TYPE.THANH_PHAM
}

export const INVENTORY_UNIT_OPTIONS = [
  { value: 'Gram', label: 'GRAM' },
  { value: 'Piece', label: 'PIECE' },
]

export function getInventoryUnitLabel(value) {
  if (value === 'Gram') return 'GRAM'
  if (value === 'Piece') return 'PIECE'
  return value || '—'
}

export function getInventoryUnitShortLabel(value) {
  if (value === 'Gram') return 'g'
  if (value === 'Piece') return 'cái'
  return ''
}
