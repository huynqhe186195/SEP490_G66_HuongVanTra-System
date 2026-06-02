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

export function mapPosCustomer(item) {
  return {
    customerId: item.customerId ?? item.CustomerId,
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    phone: item.phone ?? item.Phone ?? '',
  }
}

export function mapPosCustomerContext(item) {
  return {
    customerId: item.customerId ?? item.CustomerId,
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    customerType: item.customerType ?? item.CustomerType ?? '',
    phone: item.phone ?? item.Phone ?? '',
    email: item.email ?? item.Email ?? '',
    address: item.address ?? item.Address ?? '',
    tierCode: item.tierCode ?? item.TierCode ?? '',
    outstandingBalance: Number(item.outstandingBalance ?? item.OutstandingBalance ?? 0),
    recentOrders: (item.recentOrders ?? item.RecentOrders ?? []).map((row) => ({
      orderCode: row.orderCode ?? row.OrderCode ?? '',
      entryType: row.entryType ?? row.EntryType ?? '',
      amount: Number(row.amount ?? row.Amount ?? 0),
      paymentStatus: row.paymentStatus ?? row.PaymentStatus ?? '',
      orderStatus: row.orderStatus ?? row.OrderStatus ?? '',
      cashierName: row.cashierName ?? row.CashierName ?? '',
      cashierRole: row.cashierRole ?? row.CashierRole ?? '',
      createdAt: row.createdAt ?? row.CreatedAt,
    })),
    unpaidOrders: (item.unpaidOrders ?? item.UnpaidOrders ?? []).map((row) => ({
      orderCode: row.orderCode ?? row.OrderCode ?? '',
      totalAmount: Number(row.totalAmount ?? row.TotalAmount ?? 0),
      paidAmount: Number(row.paidAmount ?? row.PaidAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? row.RemainingAmount ?? 0),
      paymentStatus: row.paymentStatus ?? row.PaymentStatus ?? '',
      createdAt: row.createdAt ?? row.CreatedAt,
    })),
  }
}

export async function fetchPosCustomerContext(customerId) {
  const data = await requestWithAuth(`/api/PosOrder/customers/${customerId}/context`, {
    method: 'GET',
  })
  return mapPosCustomerContext(data)
}

export async function fetchPosCustomers({ search, limit = 20 }) {
  const query = new URLSearchParams()
  if (search?.trim()) query.set('search', search.trim())
  query.set('limit', String(limit))

  const items = await requestWithAuth(`/api/PosOrder/customers?${query.toString()}`, {
    method: 'GET',
  })

  return Array.isArray(items) ? items.map(mapPosCustomer) : []
}

export function createPosCustomer(payload) {
  return requestWithAuth('/api/PosOrder/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(mapPosCustomer)
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
