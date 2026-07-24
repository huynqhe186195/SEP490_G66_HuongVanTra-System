const GRAM_UNITS = new Set(['gram', 'grams', 'g'])
const PIECE_UNITS = new Set(['piece', 'pieces', 'cai', 'chiếc'])

export function normalizePosInventoryUnit(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (GRAM_UNITS.has(normalized)) return 'Gram'
  if (PIECE_UNITS.has(normalized)) return 'Piece'
  throw new Error(`Đơn vị tồn kho "${value || 'không xác định'}" chưa được POS hỗ trợ.`)
}

export function normalizePosBaseQuantity(value, inventoryUnit) {
  const unit = normalizePosInventoryUnit(inventoryUnit)
  const normalizedValue =
    typeof value === 'string' ? value.trim().replace(',', '.') : value
  const quantity = Number(normalizedValue)

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    const unitLabel = unit === 'Gram' ? 'gram' : 'sản phẩm theo chiếc'
    throw new Error(`Số lượng ${unitLabel} phải là số nguyên dương; hệ thống không tự làm tròn.`)
  }

  if (!Number.isSafeInteger(quantity)) {
    throw new Error('Số lượng sản phẩm vượt quá giới hạn cho phép.')
  }

  return quantity
}

export function getPosBaseUnitLabel(inventoryUnit) {
  return normalizePosInventoryUnit(inventoryUnit) === 'Gram' ? 'g' : 'cái'
}
