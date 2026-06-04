import { loadAuthSession } from '../../auth/services/authSession.js'

const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function parseJsonError(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (body && typeof body === 'object') {
      if (body.code === 'INSUFFICIENT_STOCK') {
        const error = new Error(body.message || 'Không đủ tồn kho.')
        error.code = 'INSUFFICIENT_STOCK'
        error.shortages = (body.shortages ?? body.Shortages ?? []).map(mapShortageItem)
        return error
      }
      if (typeof body.message === 'string' && body.message.trim()) return new Error(body.message)
      if (typeof body.detail === 'string' && body.detail.trim()) return new Error(body.detail)
      if (typeof body.title === 'string' && body.title.trim()) return new Error(body.title)
    }
  }

  const text = await response.text().catch(() => '')
  return new Error(text.trim() || 'Có lỗi xảy ra.')
}

async function requestWithAuth(path, options = {}) {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${session.accessToken}`,
    },
  })

  if (!response.ok) {
    throw await parseJsonError(response)
  }

  if (response.status === 204) return null
  return response.json()
}

function mapQueueItem(item) {
  return {
    queueId: item.queueId ?? item.QueueId,
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    queueStatus: String(item.queueStatus ?? item.QueueStatus ?? '').toLowerCase(),
    orderPaymentStatus: String(item.orderPaymentStatus ?? item.OrderPaymentStatus ?? '').toLowerCase(),
    orderStockStatus: String(item.orderStockStatus ?? item.OrderStockStatus ?? '').toLowerCase(),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0),
    createdAt: item.createdAt ?? item.CreatedAt,
  }
}

function mapPreviewItem(item) {
  return {
    productId: item.productId ?? item.ProductId,
    materialId: item.materialId ?? item.MaterialId,
    materialName: item.materialName ?? item.MaterialName ?? '',
    requiredQuantity: Number(item.requiredQuantity ?? item.RequiredQuantity ?? 0),
    availableQuantity: Number(item.availableQuantity ?? item.AvailableQuantity ?? 0),
    shortageQuantity: Number(item.shortageQuantity ?? item.ShortageQuantity ?? 0),
    status: String(item.status ?? item.Status ?? '').toLowerCase(),
  }
}

function mapShortageItem(item) {
  return {
    productId: item.productId ?? item.ProductId,
    materialId: item.materialId ?? item.MaterialId,
    requiredQuantity: Number(item.requiredQuantity ?? item.RequiredQuantity ?? 0),
    availableQuantity: Number(item.availableQuantity ?? item.AvailableQuantity ?? 0),
    shortageQuantity: Number(item.shortageQuantity ?? item.ShortageQuantity ?? 0),
  }
}

function mapPreview(data) {
  return {
    queueId: data.queueId ?? data.QueueId,
    orderId: data.orderId ?? data.OrderId,
    orderCode: data.orderCode ?? data.OrderCode ?? '',
    queueStatus: String(data.queueStatus ?? data.QueueStatus ?? '').toLowerCase(),
    orderStockStatus: String(data.orderStockStatus ?? data.OrderStockStatus ?? '').toLowerCase(),
    canDeduct: Boolean(data.canDeduct ?? data.CanDeduct),
    items: (data.items ?? data.Items ?? []).map(mapPreviewItem),
  }
}

function mapConfirmResult(data) {
  return {
    queueId: data.queueId ?? data.QueueId,
    orderId: data.orderId ?? data.OrderId,
    orderCode: data.orderCode ?? data.OrderCode ?? '',
    queueStatus: String(data.queueStatus ?? data.QueueStatus ?? '').toLowerCase(),
    orderStockStatus: String(data.orderStockStatus ?? data.OrderStockStatus ?? '').toLowerCase(),
    confirmedAt: data.confirmedAt ?? data.ConfirmedAt,
  }
}

export async function fetchPendingStockDeductQueues({ status, search } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search?.trim()) params.set('search', search.trim())
  const query = params.toString()
  const path = query ? `/api/stock-deduct-queue/waiting?${query}` : '/api/stock-deduct-queue/waiting'
  const items = await requestWithAuth(path, { method: 'GET' })
  return Array.isArray(items) ? items.map(mapQueueItem) : []
}

export async function previewStockDeductQueue(queueId) {
  const data = await requestWithAuth(`/api/stock-deduct-queue/${queueId}/preview`, { method: 'GET' })
  return mapPreview(data)
}

export async function confirmStockDeductQueue(queueId) {
  const data = await requestWithAuth(`/api/stock-deduct-queue/${queueId}/confirm`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
  return mapConfirmResult(data)
}

export async function cancelStockDeductQueue(queueId, reason = '') {
  const data = await requestWithAuth(`/api/stock-deduct-queue/${queueId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason: reason || undefined }),
  })
  return mapConfirmResult(data)
}
