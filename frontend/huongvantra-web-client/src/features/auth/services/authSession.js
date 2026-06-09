const AUTH_SESSION_KEY = 'hv-auth-session'

export function formatDisplayName(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export const AUTH_SESSION_CHANGED_EVENT = 'hv-auth-session-changed'

export function saveAuthSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT))
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