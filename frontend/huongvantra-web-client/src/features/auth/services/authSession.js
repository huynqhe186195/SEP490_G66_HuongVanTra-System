const AUTH_SESSION_KEY = 'hv-auth-session'

export function saveAuthSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function loadAuthSession() {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY)

  if (!rawSession) {
    return null
  }

  try {
    return JSON.parse(rawSession)
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
}