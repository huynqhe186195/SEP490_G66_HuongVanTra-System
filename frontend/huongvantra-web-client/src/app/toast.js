import { isAuthLoggingOut } from '../features/auth/services/authSession.js'

export const CLEAR_TOASTS_EVENT = 'app-toast-clear'

// Lightweight toast API. Emits a CustomEvent 'app-toast' on window.
export function showToast(message, type = 'info') {
  try {
    // Đang logout: nuốt mọi toast (403 in-flight, route guard, catch của trang…).
    if (isAuthLoggingOut()) return
    const ev = new CustomEvent('app-toast', { detail: { message, type } })
    window.dispatchEvent(ev)
  }
  catch (e) {
    // fallback: console
    // eslint-disable-next-line no-console
    console.warn('showToast failed', e)
  }
}

export function clearToasts() {
  try {
    window.dispatchEvent(new CustomEvent(CLEAR_TOASTS_EVENT))
  } catch {
    // ignore
  }
}

export function showInfo(message) { showToast(message, 'info') }
export function showError(message) { showToast(message, 'error') }
export function showSuccess(message) { showToast(message, 'success') }
