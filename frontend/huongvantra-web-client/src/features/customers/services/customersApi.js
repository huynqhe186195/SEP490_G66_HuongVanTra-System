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
  return text.trim() || 'Có lỗi xảy ra.'
}

async function requestWithAuth(path, options = {}) {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
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

export function mapCustomer(item) {
  if (!item || typeof item !== 'object') return null
  return {
    customerId: item.customerId ?? item.CustomerId,
    customerCode: item.customerCode ?? item.CustomerCode ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    customerType: item.customerType ?? item.CustomerType ?? '',
    phone: item.phone ?? item.Phone ?? '',
    email: item.email ?? item.Email ?? '',
    status: item.status ?? item.Status ?? '',
    tierId: item.tierId ?? item.TierId ?? null,
    tierCode: item.tierCode ?? item.TierCode ?? null,
    assignedEmployeeId: item.assignedEmployeeId ?? item.AssignedEmployeeId ?? null,
    assignedEmployeeName: item.assignedEmployeeName ?? item.AssignedEmployeeName ?? null,
    totalSpend: Number(item.totalSpend ?? item.TotalSpend ?? 0),
    currentDebt: Number(item.currentDebt ?? item.CurrentDebt ?? 0),
    tier: item.tier ?? item.Tier ?? null,
    address: item.address ?? item.Address ?? '',
  }
}

export function mapCustomerDetail(item) {
  const base = mapCustomer(item)
  if (!base) return null
  const tier = item.tier ?? item.Tier
  return {
    ...base,
    tier: tier
      ? {
          tierId: tier.tierId ?? tier.TierId,
          tierCode: tier.tierCode ?? tier.TierCode ?? '',
          minTotalSpend: Number(tier.minTotalSpend ?? tier.MinTotalSpend ?? 0),
          discountPercent: Number(tier.discountPercent ?? tier.DiscountPercent ?? 0),
        }
      : null,
  }
}

export async function fetchCustomers(params = {}) {
  const search = new URLSearchParams()
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.customerType) search.set('customerType', params.customerType)
  if (params.status) search.set('status', params.status)
  if (params.tierId) search.set('tierId', String(params.tierId))
  if (params.assignedEmployeeId) search.set('assignedEmployeeId', String(params.assignedEmployeeId))
  if (params.hasDebt) search.set('hasDebt', 'true')
  if (params.minDebt != null) search.set('minDebt', String(params.minDebt))
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.sortOrder) search.set('sortOrder', params.sortOrder)

  const query = search.toString()
  const path = query ? `/api/customers?${query}` : '/api/customers'
  const data = await requestWithAuth(path, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapCustomer).filter(Boolean) : []
}

export async function fetchCustomersWithDebt(params = {}) {
  const search = new URLSearchParams()
  if (params.minDebt != null) search.set('minDebt', String(params.minDebt))
  if (params.sortOrder) search.set('sortOrder', params.sortOrder)
  const query = search.toString()
  const path = query ? `/api/customers/with-debt?${query}` : '/api/customers/with-debt'
  const data = await requestWithAuth(path, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapCustomer).filter(Boolean) : []
}

export async function fetchCustomerById(customerId) {
  const data = await requestWithAuth(`/api/customers/${customerId}`, { method: 'GET' })
  return mapCustomerDetail(data)
}

export function createCustomer(payload) {
  return requestWithAuth('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(mapCustomerDetail)
}

export function updateCustomer(customerId, payload) {
  return requestWithAuth(`/api/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(mapCustomerDetail)
}

export function changeCustomerStatus(customerId, status) {
  return requestWithAuth(`/api/customers/${customerId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(mapCustomerDetail)
}

export async function reconcileCustomerDebt(customerId) {
  return requestWithAuth(`/api/customers/${customerId}/reconcile-debt`, {
    method: 'POST',
  })
}

export function fetchMembershipTiers() {
  return requestWithAuth('/api/customer/tiers', { method: 'GET' })
}
