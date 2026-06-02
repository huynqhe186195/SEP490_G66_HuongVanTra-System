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

export function fetchMyProfile() {
  return requestWithAuth('/api/profile/me', { method: 'GET' })
}

export function updateMyProfile(payload) {
  return requestWithAuth('/api/profile/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
