import { clearAuthSession, loadAuthSession, saveAuthSession } from '../features/auth/services/authSession.js'
import { showError } from '../app/toast.js'

export const DEFAULT_API_BASE_URL = 'http://localhost:5000'

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

export async function parseApiErrorBody(response) {
  const status = response.status
  const fallback = `Có lỗi xảy ra (HTTP ${status}).`

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    const isHtml = text.trimStart().startsWith('<')
    return { message: (!isHtml && text.trim()) || fallback, errors: [], statusCode: status }
  }

  const body = await response.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return { message: fallback, errors: [], statusCode: status }
  }

  let errors = []
  if (Array.isArray(body.errors)) {
    errors = body.errors.filter(Boolean).map(String)
  } else if (body.errors && typeof body.errors === 'object') {
    errors = Object.values(body.errors).flat().filter(Boolean).map(String)
  }

  const message =
    errors.join(' ') ||
    (typeof body.error === 'string' && body.error.trim()) ||
    (typeof body.message === 'string' && body.message.trim()) ||
    (typeof body.title === 'string' && body.title.trim()) ||
    fallback

  return { message, errors, statusCode: body.statusCode ?? status, body }
}

export async function parseResponseError(response) {
  const { message } = await parseApiErrorBody(response)
  return message
}

export function decodeJwtPayload(token) {
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

export function getPermissionsFromAccessToken(accessToken) {
  const payload = decodeJwtPayload(accessToken)
  const raw = payload.permission ?? payload.permissions ?? payload.Permission ?? payload.Permissions ?? []
  if (Array.isArray(raw)) return [...new Set(raw.map(String).filter(Boolean))]
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
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
  const responsePermissions = data.permissions ?? data.Permissions ?? []
  const tokenPermissions = getPermissionsFromAccessToken(data.accessToken)
  const nextSession = {
    ...session,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    username: data.username ?? session.username,
    roles: data.roles ?? data.Roles ?? session.roles ?? [],
    permissions: [...new Set([...responsePermissions, ...tokenPermissions, ...(session.permissions ?? [])].map(String).filter(Boolean))],
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = {
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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
  const silentAuthErrors = Boolean(options.silentAuthErrors)
  const { silentAuthErrors: _silent, responseType, ...fetchOptions } = options
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  let session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const headers = {
    ...(fetchOptions.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(fetchOptions.headers || {}),
    Authorization: `Bearer ${session.accessToken}`,
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (response.status === 401 && retry && session.refreshToken) {
    try {
      session = await refreshSession(session)
      response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...fetchOptions,
        headers: {
          ...headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
      })
    } catch {
      if (!silentAuthErrors) {
        handleAuthFailure('Phiên đăng nhập đã hết hạn.', 401)
      }
      throw new Error('Phiên đăng nhập đã hết hạn.')
    }
  }

  if (!response.ok) {
    const { message, errors, body } = await parseApiErrorBody(response)
    if (!silentAuthErrors && (response.status === 401 || response.status === 403)) {
      handleAuthFailure(message, response.status)
    }
    const error = new Error(message)
    error.apiErrors = errors
    error.statusCode = response.status
    error.body = body
    throw error
  }

  if (response.status === 204) return null

  if (responseType === 'blob') {
    return response.blob()
  }

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
  const totalCount = Number(
    data.totalCount ?? data.TotalCount ?? data.totalItems ?? data.TotalItems ?? items.length ?? 0,
  )
  const pageSize = Number(data.pageSize ?? data.PageSize ?? 20)
  return {
    items: Array.isArray(items) ? items : [],
    page: Number(data.page ?? data.Page ?? 1),
    pageSize,
    totalCount,
    totalItems: totalCount,
    totalPages: Number(
      data.totalPages ?? data.TotalPages ?? (pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1),
    ),
  }
}
