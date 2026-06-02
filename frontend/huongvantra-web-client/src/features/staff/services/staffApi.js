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

export function fetchStaffAccount(userId) {
  return requestWithAuth(`/api/staff-accounts/${userId}`, { method: 'GET' })
}

export function fetchStaffAccounts(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.role) search.set('role', params.role)
  if (typeof params.isActive === 'boolean') search.set('isActive', String(params.isActive))
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))

  const query = search.toString()
  const path = query ? `/api/staff-accounts?${query}` : '/api/staff-accounts'
  return requestWithAuth(path, { method: 'GET' })
}

export function updateStaffAccount(userId, payload) {
  return requestWithAuth(`/api/staff-accounts/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function fetchRoleOptions() {
  return requestWithAuth('/api/staff-accounts/roles', { method: 'GET' })
}

export function assignStaffRoles(userId, roles) {
  return requestWithAuth(`/api/staff-accounts/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles }),
  })
}

export function createStaffAccount(payload) {
  return requestWithAuth('/api/staff-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
