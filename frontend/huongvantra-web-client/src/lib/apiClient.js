import { clearAuthSession, loadAuthSession, saveAuthSession } from '../features/auth/services/authSession.js'
import { showError } from '../app/toast.js'

export const DEFAULT_API_BASE_URL = 'http://localhost:5000'

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

export async function parseResponseError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (typeof body.title === 'string' && body.title.trim()) return body.title
      if (body.errors && typeof body.errors === 'object') {
        const messages = Object.values(body.errors).flat().filter(Boolean)
        if (messages.length) return messages.join(' ')
      }
      if (typeof body.error === 'string' && body.error.trim()) return body.error
      if (Array.isArray(body.errors) && body.errors.length) {
        return body.errors.filter(Boolean).join(' ')
      }
    }
  }

  const text = await response.text().catch(() => '')
  return text.trim() || 'Có lỗi xảy ra.'
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return {}

  try {
    const payload = token.split('.')[1]
    if (!payload) return {}
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized))
  } catch {
    return {}
  }
}

export function getUserIdFromToken(accessToken) {
  const payload = decodeJwtPayload(accessToken)
  return payload.sub || payload.nameid || null
}

async function refreshSession(session) {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response))
  }

  const data = await response.json()
  const nextSession = {
    ...session,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    username: data.username ?? session.username,
    roles: data.roles ?? session.roles ?? [],
    permissions: data.permissions ?? session.permissions ?? [],
    userId: getUserIdFromToken(data.accessToken) ?? session.userId,
  }

  saveAuthSession(nextSession)
  return nextSession
}

function handleAuthFailure(message, status) {
  try {
    if (status === 401) {
      showError(message || 'Phiên đăng nhập đã hết hạn.')
      clearAuthSession()
      window.location.href = '/login'
      return
    }

    if (status === 403) {
      showError(message || 'Bạn không có quyền thực hiện thao tác này.')
    }
  } catch {
    // ignore toast/navigation errors
  }
}

export async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response))
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function apiRequestAuth(path, options = {}, retry = true) {
  let session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
    Authorization: `Bearer ${session.accessToken}`,
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && retry && session.refreshToken) {
    try {
      session = await refreshSession(session)
      response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
      })
    } catch {
      handleAuthFailure('Phiên đăng nhập đã hết hạn.', 401)
      throw new Error('Phiên đăng nhập đã hết hạn.')
    }
  }

  if (!response.ok) {
    const message = await parseResponseError(response)
    if (response.status === 401 || response.status === 403) {
      handleAuthFailure(message, response.status)
    }
    throw new Error(message)
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export function toPagedResult(data) {
  if (!data || typeof data !== 'object') {
    return { items: [], page: 1, pageSize: 20, totalCount: 0 }
  }

  const items = data.items ?? data.Items ?? []
  return {
    items: Array.isArray(items) ? items : [],
    page: Number(data.page ?? data.Page ?? 1),
    pageSize: Number(data.pageSize ?? data.PageSize ?? 20),
    totalCount: Number(data.totalCount ?? data.TotalCount ?? items.length ?? 0),
  }
}
