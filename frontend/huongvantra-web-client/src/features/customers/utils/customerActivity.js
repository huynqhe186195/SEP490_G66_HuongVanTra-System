const STORAGE_KEY = 'hv-customer-integration-activity'
const MAX_ITEMS = 50

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function pushCustomerIntegrationActivity(entry) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  }
  writeAll([item, ...readAll()])
  return item
}

export function getCustomerIntegrationActivities(limit = 20) {
  return readAll().slice(0, limit)
}

export function formatActivityTime(iso) {
  if (!iso) return ''
  const value = String(iso).trim()
  // Hoạt động cũ có thể được API trả về mà không kèm offset. Các mốc này vốn được lưu theo UTC.
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  const occurredAt = new Date(hasOffset ? value : `${value}Z`).getTime()
  if (Number.isNaN(occurredAt)) return ''
  const diffMs = Math.max(0, Date.now() - occurredAt)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Hôm qua' : `${days} ngày trước`
}
