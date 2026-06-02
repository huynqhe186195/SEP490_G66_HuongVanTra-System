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

export function fetchCustomers(params = {}) {
  const search = new URLSearchParams()
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.customerType) search.set('customerType', params.customerType)
  if (params.status) search.set('status', params.status)
  if (params.tierId) search.set('tierId', String(params.tierId))
  if (params.assignedEmployeeId) search.set('assignedEmployeeId', String(params.assignedEmployeeId))

  const query = search.toString()
  const path = query ? `/api/customers?${query}` : '/api/customers'
  return requestWithAuth(path, { method: 'GET' })
}

export function fetchCustomerById(customerId) {
  return requestWithAuth(`/api/customers/${customerId}`, { method: 'GET' })
}

export function createCustomer(payload) {
  return requestWithAuth('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateCustomer(customerId, payload) {
  return requestWithAuth(`/api/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function changeCustomerStatus(customerId, status) {
  return requestWithAuth(`/api/customers/${customerId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export function fetchMembershipTiers() {
  return requestWithAuth('/api/customer/tiers', { method: 'GET' })
}
