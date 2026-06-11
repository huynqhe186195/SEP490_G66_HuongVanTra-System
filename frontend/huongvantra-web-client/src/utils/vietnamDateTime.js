/** Gio Viet Nam = UTC + 7 */
export const VIETNAM_UTC_OFFSET_HOURS = 7

const OFFSET_MS = VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000

function hasTimezoneSuffix(value) {
  return /[zZ]$|[+-]\d{2}(:?\d{2})?$/.test(value)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * Parse chuoi/ngay API, thuong la UTC.
 */
export function parseUtcDateTime(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const iso = hasTimezoneSuffix(raw) ? raw : `${raw}${raw.includes('T') ? 'Z' : ''}`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Cong 7 gio len moc UTC, sau do dung getUTC* de hien thi gio VN.
 */
export function addUtcPlus7(value) {
  const utc = parseUtcDateTime(value)
  if (!utc) return null
  return new Date(utc.getTime() + OFFSET_MS)
}

/**
 * Hien thi ngay gio theo gio Viet Nam (UTC+7).
 */
export function formatVietnamDateTime(value) {
  const vn = value == null ? addUtcPlus7(new Date()) : addUtcPlus7(value)
  if (!vn) return '—'

  const day = pad(vn.getUTCDate())
  const month = pad(vn.getUTCMonth() + 1)
  const year = vn.getUTCFullYear()
  const hour = pad(vn.getUTCHours())
  const minute = pad(vn.getUTCMinutes())
  const second = pad(vn.getUTCSeconds())

  return `${day}/${month}/${year}, ${hour}:${minute}:${second}`
}

export function formatVietnamDateTimeMinute(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return '—'

  const day = pad(vn.getUTCDate())
  const month = pad(vn.getUTCMonth() + 1)
  const year = vn.getUTCFullYear()
  const hour = pad(vn.getUTCHours())
  const minute = pad(vn.getUTCMinutes())

  return `${day}/${month}/${year} ${hour}:${minute}`
}

/** Gio hien tai (VN) cho bien lai / UI */
export function vietnamNowLabel() {
  return formatVietnamDateTime(new Date())
}

/** Chi ngay theo gio Viet Nam (dd/mm/yyyy). */
export function formatVietnamDate(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return '—'

  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`
}

/** Gia tri cho input type="date" theo lich VN. */
export function toVietnamDateInputValue(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return ''

  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`
}

export function toDatetimeLocalValue(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return ''

  const year = vn.getUTCFullYear()
  const month = pad(vn.getUTCMonth() + 1)
  const day = pad(vn.getUTCDate())
  const hour = pad(vn.getUTCHours())
  const minute = pad(vn.getUTCMinutes())

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function fromDatetimeLocalToUtc(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
