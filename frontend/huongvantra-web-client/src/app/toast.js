// Lightweight toast API. Emits a CustomEvent 'app-toast' on window.
export function showToast(message, type = 'info') {
  try {
    const ev = new CustomEvent('app-toast', { detail: { message, type } })
    window.dispatchEvent(ev)
  }
  catch (e) {
    // fallback: console
    // eslint-disable-next-line no-console
    console.warn('showToast failed', e)
  }
}

export function showInfo(message) { showToast(message, 'info') }
export function showError(message) { showToast(message, 'error') }
export function showSuccess(message) { showToast(message, 'success') }
