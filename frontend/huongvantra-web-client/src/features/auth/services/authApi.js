const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function parseResponseError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)

    if (body && typeof body === 'object') {
      if (typeof body.title === 'string' && body.title.trim()) {
        return body.title
      }

      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message
      }
    }
  }

  const text = await response.text().catch(() => '')
  return text.trim() || 'Đăng nhập thất bại. Vui lòng thử lại.'
}

import { showError } from '../../../app/toast'

async function request(path, options) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, options)

  if (!response.ok) {
    // handle auth/authorization errors centrally
    if (response.status === 401 || response.status === 403) {
      const errMsg = await parseResponseError(response)

      if (response.status === 401) {
        // not authenticated: show message and redirect to login
        try { showError(errMsg || 'Bạn chưa đăng nhập hoặc token không hợp lệ.'); } catch {}
        try { window.location.href = '/login'; } catch {}
      } else {
        // forbidden: show message
        try { showError(errMsg || 'Bạn không có quyền truy cập trang này.'); } catch {}
      }

      throw new Error(errMsg)
    }

    throw new Error(await parseResponseError(response))
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function login(username, password) {
  return request('/api/Auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })
}

export async function refresh(accessToken, refreshToken) {
  return request('/api/Auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accessToken, refreshToken }),
  })
}

export async function logout(accessToken, refreshToken) {
  return request('/api/Auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refreshToken }),
  })
}

export async function me(accessToken) {
  return request('/api/Auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function fetchAccess(accessToken) {
  return request('/api/access/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function enrichSessionWithAccess(session) {
  const access = await fetchAccess(session.accessToken)

  return {
    ...session,
    roles: access.roles ?? session.roles ?? [],
    modules: access.modules ?? [],
  }
}