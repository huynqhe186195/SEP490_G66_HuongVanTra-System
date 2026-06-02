import { loadAuthSession } from '../../auth/services/authSession.js'

const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function parseResponseError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (typeof body.title === 'string' && body.title.trim()) return body.title
    }
  }

  const text = await response.text().catch(() => '')
  return text.trim() || 'Co loi xay ra.'
}

async function requestWithAuth(path, options = {}) {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phien dang nhap da het han. Vui long dang nhap lai.')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response))
  }

  if (response.status === 204) return null
  return response.json()
}

export function createPosOrderOnline(payload) {
  return requestWithAuth('/api/PosOrder/online', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function createPosOrderOffline(payload) {
  return requestWithAuth('/api/PosOrder/offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function confirmOrderPayment(orderId, payload = {}) {
  return requestWithAuth(`/api/Orders/${orderId}/confirm-payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function mapPosProduct(item) {
  return {
    productId: item.productId ?? item.ProductId,
    sku: item.sku ?? item.Sku ?? '',
    name: item.name ?? item.Name ?? '',
    price: Number(item.price ?? item.Price ?? 0),
    stockQuantity: Number(item.stockQuantity ?? item.StockQuantity ?? 0),
  }
}

export async function fetchPosProducts({ storeId, search, limit = 30 }) {
  const query = new URLSearchParams()
  query.set('storeId', String(storeId))
  if (search?.trim()) query.set('search', search.trim())
  query.set('limit', String(limit))

  const items = await requestWithAuth(`/api/PosOrder/products?${query.toString()}`, {
    method: 'GET',
  })

  return Array.isArray(items) ? items.map(mapPosProduct) : []
}

export function resolvePosStoreId() {
  const session = loadAuthSession()
  const fromSession = session?.storeId ?? session?.user?.storeId ?? session?.profile?.storeId
  if (Number.isFinite(Number(fromSession)) && Number(fromSession) > 0) {
    return Number(fromSession)
  }

  const fromEnv = Number(import.meta.env.VITE_POS_STORE_ID || 1)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1
}
