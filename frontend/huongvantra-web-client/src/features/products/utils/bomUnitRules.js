const COUNT_BASED_UNITS = new Set(['cai', 'chiec', 'hop', 'tui', 'tem', 'nhan', 'goi', 'chai', 'lo'])
const MEASURE_BASED_UNITS = new Set(['gram', 'g', 'kg', 'ml', 'lit', 'l'])

export function normalizeBomUnit(unit) {
  return String(unit ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

export function isCountBasedUnit(unit) {
  return COUNT_BASED_UNITS.has(normalizeBomUnit(unit))
}

export function isMeasureBasedUnit(unit) {
  return MEASURE_BASED_UNITS.has(normalizeBomUnit(unit))
}

export function hasMaxDecimalPlaces(value, maxDecimalPlaces = 3) {
  const text = String(value ?? '').trim().replace(',', '.')
  if (!text || /e/i.test(text)) return false
  const decimalPart = text.split('.')[1] ?? ''
  return decimalPart.length <= maxDecimalPlaces
}

export function getBomQuantityValidationMessage(quantity, unit) {
  const text = String(quantity ?? '').trim()
  const normalizedText = text.replace(',', '.')
  const value = Number(normalizedText)

  if (!text || !Number.isFinite(value) || value <= 0) {
    return 'Định mức phải lớn hơn 0.'
  }

  if (isCountBasedUnit(unit) && !Number.isInteger(value)) {
    return `Đơn vị "${unit || 'đơn vị'}" chỉ cho phép số nguyên.`
  }

  if (!hasMaxDecimalPlaces(normalizedText)) {
    return 'Định mức chỉ được tối đa 3 chữ số thập phân.'
  }

  return ''
}
