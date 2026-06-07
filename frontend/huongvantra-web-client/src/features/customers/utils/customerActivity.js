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
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Hôm qua' : `${days} ngày trước`
}
