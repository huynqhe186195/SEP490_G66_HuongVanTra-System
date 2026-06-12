/** Giờ Việt Nam = UTC + 7 */
export const VIETNAM_UTC_OFFSET_HOURS = 7

const OFFSET_MS = VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000

function pad(value) {
  return String(value).padStart(2, '0')
}

function hasTimezoneSuffix(value) {
  return /[zZ]$|[+-]\d{2}(:?\d{2})?$/.test(value)
}

/**
 * Parse chuỗi/ngày API (thường lưu UTC) thành Date UTC.
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
 * Cộng 7 giờ lên mốc UTC → dùng getUTC* khi format để ra giờ VN.
 */
export function addUtcPlus7(value) {
  const utc = parseUtcDateTime(value)
  if (!utc) return null
  return new Date(utc.getTime() + OFFSET_MS)
}

/**
 * Hiển thị ngày giờ theo giờ Việt Nam (UTC+7).
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

/** Hiển thị ngày giờ VN không có giây (dd/mm/yyyy hh:mm). */
export function formatVietnamDateTimeMinute(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return '—'

  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`
}

/** Giờ hiện tại (VN) cho biên lai / UI */
export function vietnamNowLabel() {
  return formatVietnamDateTime(new Date())
}

/** Chỉ ngày theo giờ Việt Nam (dd/mm/yyyy). */
export function formatVietnamDate(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return '—'

  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`
}

/** Giá trị cho input type="date" theo lịch VN. */
export function toVietnamDateInputValue(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return ''

  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`
}

/** Giá trị cho input type="datetime-local" theo giờ VN. */
export function toDatetimeLocalValue(value) {
  const vn = addUtcPlus7(value)
  if (!vn) return ''

  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`
}

/** Chuyển datetime-local (giờ VN) sang UTC ISO cho API. */
export function fromDatetimeLocalToUtc(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
