import { parseApiDateTime, toVietnamDateInputValue } from '../../../utils/vietnamDateTime.js'

export const HUB_CHANNELS = [
  { id: 'POS', label: 'POS', connectionType: 'Máy bán hàng' },
  { id: 'COD', label: 'COD', connectionType: 'Giao hàng tận nơi' },
]

export function shortEventType(eventType) {
  const raw = String(eventType || '').trim()
  if (!raw) return 'Sự kiện'
  const last = raw.split('.').pop() || raw
  return last.replace(/Event$/i, '') || last
}

export function parseOutboxPayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload
  const raw = String(payload || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return ''
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return ''
}

export function normalizeOperatingChannel(value) {
  if (value === 0 || value === '0') return 'POS'
  if (value === 1 || value === '1') return 'Website'
  if (value === 2 || value === '2') return 'Zalo'
  if (value === 3 || value === '3') return 'Phone'
  if (value === 4 || value === '4') return 'COD'
  if (value === 5 || value === '5') return 'B2B'
  const key = String(value || '').trim().toUpperCase()
  if (key === 'POS') return 'POS'
  if (key === 'WEBSITE' || key === 'WEB') return 'Website'
  if (key === 'ZALO' || key === 'ZALOOA') return 'Zalo'
  if (key === 'PHONE') return 'Phone'
  if (key === 'COD') return 'COD'
  if (key === 'B2B' || key === 'AGENCY' || key === 'ĐẠI LÝ' || key === 'DAI LY') return 'B2B'
  return ''
}

export function extractOutboxContext(message) {
  const payload = parseOutboxPayload(message?.payload)
  const orderCode = pick(payload, 'orderCode', 'OrderCode')
  const orderId = pick(payload, 'orderId', 'OrderId') || String(message?.aggregateId || '')
  const channel = inferOperatingChannel({
    orderChannel: pick(payload, 'orderChannel', 'OrderChannel', 'channel', 'Channel'),
    eventType: message?.eventType,
    orderCode,
  })
  return {
    channel,
    orderCode,
    orderId,
    customerName: pick(payload, 'customerSnapshotName', 'CustomerSnapshotName'),
  }
}

export function inferOperatingChannel({ orderChannel, eventType, orderCode } = {}) {
  const direct = normalizeOperatingChannel(orderChannel)
  if (direct === 'POS' || direct === 'COD') return direct
  const code = String(orderCode || '').toUpperCase()
  if (code.startsWith('COD')) return 'COD'
  if (code.startsWith('POS')) return 'POS'
  const type = shortEventType(eventType).toLowerCase()
  if (type.includes('ship')) return 'COD'
  if (type.includes('placed') || type.includes('complete') || type.includes('cancel') || type.includes('return')) {
    return 'POS'
  }
  return ''
}

export function channelLabel(channel) {
  const found = HUB_CHANNELS.find((item) => item.id === channel)
  return found?.label || '—'
}

export function channelConnectionType(channel) {
  const found = HUB_CHANNELS.find((item) => item.id === channel)
  return found?.connectionType || '—'
}

export function eventActionLabel(eventType) {
  const key = shortEventType(eventType).toLowerCase()
  if (key.includes('placed')) return 'Đặt đơn'
  if (key.includes('cancel')) return 'Hủy đơn'
  if (key.includes('return')) return 'Trả hàng'
  if (key.includes('ship')) return 'Giao hàng'
  if (key.includes('complete')) return 'Hoàn tất'
  return 'Đồng bộ'
}

export function buildErrorHint(message) {
  const type = shortEventType(message?.eventType).toLowerCase()
  const error = String(message?.lastError || '').toLowerCase()
  if (error.includes('sku') || error.includes('product')) {
    return 'Kiểm tra SKU và tạo sản phẩm tương ứng'
  }
  if (error.includes('phone') || error.includes('số điện thoại')) {
    return 'Bổ sung số điện thoại rồi gửi lại hoặc tạo đơn thủ công'
  }
  if (error.includes('duplicate') || error.includes('trùng')) {
    return 'Kiểm tra mã đơn trùng rồi gửi lại hoặc bỏ qua'
  }
  if (error.includes('timeout') || error.includes('timed out')) {
    return 'Kho chưa nhận kịp. Gửi lại.'
  }
  if (error.includes('connect') || error.includes('broker') || error.includes('rabbit')) {
    return 'Hàng đợi kho đang đứt. Gửi lại khi máy chủ ổn.'
  }
  if (type.includes('placed')) return 'Đặt đơn chưa tới kho. Gửi lại hoặc tạo đơn thủ công.'
  if (type.includes('cancel')) return 'Hủy đơn chưa tới kho. Gửi lại.'
  if (type.includes('return')) return 'Trả hàng chưa tới kho. Gửi lại.'
  if (type.includes('ship')) return 'Giao hàng chưa tới kho. Gửi lại.'
  if (type.includes('complete')) return 'Hoàn tất đơn chưa tới kho. Gửi lại.'
  return 'Gửi lại, tạo đơn thủ công, hoặc bỏ qua lỗi này.'
}

export function errorCode(message, index = 0) {
  const channel = message?.orderChannel || extractOutboxContext(message).channel || 'UNK'
  const prefix = channel === 'POS' ? 'POS' : channel === 'COD' ? 'COD' : 'ERR'
  const n = String(index + 1).padStart(2, '0')
  return `${prefix}-ERR-${n}`
}

export function formatSyncAgo(value) {
  const date = parseApiDateTime(value)
  if (!date) return '—'
  const diffMs = Math.max(0, Date.now() - date.getTime())
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Hôm qua' : `${days} ngày trước`
}

export function isVietnamToday(value) {
  const date = parseApiDateTime(value)
  if (!date) return false
  return toVietnamDateInputValue(date) === toVietnamDateInputValue(new Date())
}

export function buildHubRows(messages = []) {
  return HUB_CHANNELS.map((channel) => {
    const related = messages.filter((item) => item.orderChannel === channel.id)
    const failed = related.filter((item) => item.status === 'Failed')
    const latest = related.reduce((best, item) => {
      const stamp = item.publishedAtUtc || item.lastAttemptAtUtc || item.occurredAtUtc
      if (!stamp) return best
      if (!best) return stamp
      const a = parseApiDateTime(stamp)?.getTime() ?? 0
      const b = parseApiDateTime(best)?.getTime() ?? 0
      return a > b ? stamp : best
    }, null)
    return {
      ...channel,
      lastSyncAt: latest,
      lastSyncLabel: formatSyncAgo(latest),
      pendingErrors: failed.length,
      status: 'Hoạt động',
    }
  })
}
