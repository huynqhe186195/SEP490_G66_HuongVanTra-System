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

export function getBomQuantityValidationMessage(quantity) {
  const text = String(quantity ?? '').trim()
  if (!/^[1-9]\d*$/.test(text)) {
    return 'Định mức phải là số nguyên dương.'
  }

  return ''
}
