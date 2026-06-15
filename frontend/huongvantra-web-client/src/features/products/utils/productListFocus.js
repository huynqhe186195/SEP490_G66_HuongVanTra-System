const STORAGE_KEY = 'hvt_products_list_focus'

export function setProductListFocus(product, options = {}) {
  const name = String(product?.name || options.name || '').trim()
  const id = product?.id ? String(product.id) : options.id ? String(options.id) : ''
  if (!id && !name) return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: id || null,
        name,
        statusFilter: options.statusFilter || 'all',
        showBanner: Boolean(options.showBanner),
      }),
    )
  } catch {
    // ignore storage errors
  }
}

export function readHighlightProductIdFromUrl() {
  try {
    const id = new URLSearchParams(window.location.search).get('highlight')
    return id ? String(id) : null
  } catch {
    return null
  }
}

export function consumeProductListFocus() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    const parsed = JSON.parse(raw)
    if (!parsed?.id && !parsed?.name) return null
    return {
      id: parsed.id ? String(parsed.id) : null,
      name: String(parsed.name || '').trim(),
      statusFilter: parsed.statusFilter || 'all',
      showBanner: Boolean(parsed.showBanner),
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}
