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

async function request(path, options) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, options)

  if (!response.ok) {
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