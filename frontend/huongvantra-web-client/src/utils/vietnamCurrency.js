const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
})

export function formatVnd(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? vndFormatter.format(number) : fallback
}

export function sanitizeVndInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/^0+(?=\d)/, '')
}

export function formatVndInput(value) {
  const digits = sanitizeVndInput(value)
  if (!digits) return ''
  const number = Number(digits)
  return Number.isSafeInteger(number) ? integerFormatter.format(number) : digits
}

export function parseVndInput(value) {
  const digits = sanitizeVndInput(value)
  if (!digits) return null
  const number = Number(digits)
  return Number.isSafeInteger(number) ? number : null
}
