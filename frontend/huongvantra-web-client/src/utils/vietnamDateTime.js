export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
/** Giờ Việt Nam = UTC + 7 */
export const VIETNAM_UTC_OFFSET_HOURS = 7

function hasTimezoneSuffix(value) {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
}

/**
 * Parse chuỗi/ngày API (thường lưu UTC) thành Date.
 * DateTime không có timezone được xem là UTC để tránh lệch ngày ở UI Việt Nam.
 */
export function parseApiDateTime(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const dateOnly = new Date(`${normalized}T00:00:00Z`)
    return Number.isNaN(dateOnly.getTime()) ? null : dateOnly
  }
  const iso = hasTimezoneSuffix(normalized) ? normalized : `${normalized}Z`
  const safeIso = iso.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$|$)/, '$1')
  const date = new Date(safeIso)
  return Number.isNaN(date.getTime()) ? null : date
}

export const parseUtcDateTime = parseApiDateTime

function vietnamParts(value, options = {}) {
  const date = parseApiDateTime(value)
  if (!date) return null

  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    ...options,
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return {
    day: parts.day,
    month: parts.month,
    year: parts.year,
    hour: parts.hour === '24' ? '00' : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/**
 * Trả về Date đã dịch sang lịch giờ Việt Nam cho những nơi còn cần getUTC*.
 */
export function addUtcPlus7(value) {
  const parts = vietnamParts(value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  if (!parts) return null

  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ))
}

/**
 * Hiển thị ngày giờ theo giờ Việt Nam (dd/mm/yyyy hh:mm:ss).
 */
export function formatVietnamDateTime(value) {
  const parts = vietnamParts(value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  if (!parts) return '—'

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

/** Hiển thị ngày giờ VN không có giây (dd/mm/yyyy hh:mm). */
export function formatVietnamDateTimeMinute(value) {
  const parts = vietnamParts(value, {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (!parts) return '—'

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

export const formatDateTimeVN = formatVietnamDateTimeMinute

/** Giờ hiện tại (VN) cho biên lai / UI */
export function vietnamNowLabel() {
  return formatVietnamDateTime(new Date())
}

/** Chỉ ngày theo giờ Việt Nam (dd/mm/yyyy). */
export function formatVietnamDate(value) {
  const parts = vietnamParts(value)
  if (!parts) return '—'

  return `${parts.day}/${parts.month}/${parts.year}`
}

export const formatDateVN = formatVietnamDate

/** Giá trị cho input type="date" theo lịch VN. */
export function toVietnamDateInputValue(value) {
  const parts = vietnamParts(value)
  if (!parts) return ''

  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Giá trị cho input type="datetime-local" theo giờ VN. */
export function toDatetimeLocalValue(value) {
  const parts = vietnamParts(value, {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (!parts) return ''

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** Chuyển datetime-local (giờ VN) sang UTC ISO cho API. */
export function fromDatetimeLocalToUtc(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
