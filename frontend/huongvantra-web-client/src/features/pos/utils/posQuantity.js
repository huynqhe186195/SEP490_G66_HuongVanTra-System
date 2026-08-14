const GRAM_UNITS = new Set(['gram', 'grams', 'g'])
const PIECE_UNITS = new Set([
  'piece',
  'pieces',
  'cai',
  'chiec',
  'goi',
  'hop',
  'tui',
  'loc',
  'thung',
  'vien',
  'chai',
  'lon',
])

function foldUnit(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function normalizePosInventoryUnit(value) {
  const normalized = foldUnit(value)
  if (!normalized) return 'Piece'
  if (GRAM_UNITS.has(normalized)) return 'Gram'
  if (PIECE_UNITS.has(normalized)) return 'Piece'

  // "Hộp 100g", "Gói trà", "Lon 500ml" là quy cách bán — đếm theo chiếc, không phải đơn vị tồn.
  const firstToken = normalized.split(/[\s/\-_]+/)[0]
  if (PIECE_UNITS.has(firstToken)) return 'Piece'
  if (GRAM_UNITS.has(firstToken)) return 'Gram'

  return 'Piece'
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
