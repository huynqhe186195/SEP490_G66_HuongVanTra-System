import { getPendingQueue, updateQueueItem, setMeta, getPendingCount } from './offlineDb.js'
import { apiRequestAuth } from './apiClient.js'
import { showSuccess, showError } from '../app/toast.js'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

let isSyncing = false

export async function drainSyncQueue() {
  if (isSyncing || !navigator.onLine) return
  isSyncing = true

  let synced = 0
  let failed = 0

  try {
    const items = await getPendingQueue()
    for (const item of items) {
      const ok = await processQueueItem(item)
      if (ok) synced++
      else failed++
    }
  } finally {
    isSyncing = false
    const remaining = await getPendingCount()
    await setMeta('pendingSyncCount', remaining)
    window.dispatchEvent(new CustomEvent('hvt-sync-queue-changed', { detail: { remaining } }))

    if (synced > 0) {
      showSuccess(
        `Đã đồng bộ ${synced} đơn hàng offline. Kiểm tra tại mục Đơn hàng.`
      )
    }
    if (failed > 0) {
      showError(`${failed} đơn không thể đồng bộ — vui lòng liên hệ quản lý.`)
    }
  }
}

async function processQueueItem(item) {
  await updateQueueItem(item.id, { status: 'PROCESSING' })

  try {
    const result = await sendToServer(item)
    console.info('[sync-queue] DONE', item.type, item.id)
    await updateQueueItem(item.id, { status: 'DONE', result })
    return true
  } catch (err) {
    const retries = (item.retries ?? 0) + 1
    const isConflict = err?.statusCode === 409

    console.error('[sync-queue] ERROR', item.type, `HTTP ${err?.statusCode}`, err.message, '\npayload:', item.payload)

    if (isConflict) {
      await updateQueueItem(item.id, { status: 'CONFLICT', lastError: err.message ?? 'Conflict' })
      return false
    }

    if (retries >= MAX_RETRIES) {
      await updateQueueItem(item.id, { status: 'FAILED', retries, lastError: err.message ?? 'Unknown error' })
      return false
    }

    await updateQueueItem(item.id, { status: 'PENDING', retries, lastError: err.message ?? 'Unknown error' })
    await delay(RETRY_DELAY_MS)
    return false
  }
}

async function sendToServer(item) {
  const headers = { 'X-Idempotency-Key': item.idempotencyKey }

  switch (item.type) {
    case 'CREATE_ORDER':
      return apiRequestAuth('/api/v1/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(item.payload),
      })

    case 'APPLY_DEBT_PAYMENT': {
      const { customerId, ...body } = item.payload
      return apiRequestAuth(`/api/customers/${customerId}/debt-payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    }

    default:
      throw new Error(`Unknown queue type: ${item.type}`)
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
