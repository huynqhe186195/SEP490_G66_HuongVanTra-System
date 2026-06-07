export function formatProductPrice(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(amount)
}

export function formatWeightGrams(value) {
  const grams = Number(value)
  if (!Number.isFinite(grams) || grams <= 0) return '—'
  if (grams >= 1000) return `${(grams / 1000).toLocaleString('vi-VN')} kg`
  return `${grams.toLocaleString('vi-VN')} g`
}

export function getProductStatusMeta(isActive) {
  if (isActive) {
    return { label: 'Đang bán', className: 'bg-emerald-50 text-emerald-700' }
  }
  return { label: 'Ngừng kinh doanh', className: 'bg-slate-100 text-slate-500' }
}

export function pickProductImageUrl(productOrSkus) {
  const skus = Array.isArray(productOrSkus) ? productOrSkus : productOrSkus?.skus
  if (!Array.isArray(skus) || !skus.length) return ''

  const withImage = (list) => list.find((sku) => String(sku.imageUrl || '').trim())
  const activeSku = withImage(skus.filter((sku) => sku.isActive))
  if (activeSku) return activeSku.imageUrl

  const anySku = withImage(skus)
  return anySku?.imageUrl || ''
}

export function summarizeProductSkus(skus = []) {
  if (!skus.length) {
    return { count: 0, priceLabel: '—', codes: '—', imageUrl: '' }
  }
  const activeSkus = skus.filter((sku) => sku.isActive)
  const list = activeSkus.length ? activeSkus : skus
  const prices = list.map((sku) => Number(sku.basePrice)).filter(Number.isFinite)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const priceLabel = min === max ? formatProductPrice(min) : `${formatProductPrice(min)} – ${formatProductPrice(max)}`
  const codes = list.map((sku) => sku.skuCode).slice(0, 3).join(', ')
  return {
    count: skus.length,
    priceLabel,
    codes: skus.length > 3 ? `${codes}…` : codes,
    imageUrl: pickProductImageUrl(skus),
  }
}

export function buildCategoryOptions(categories = [], excludeId = null) {
  return categories
    .filter((item) => item.id !== excludeId)
    .map((item) => ({
      value: String(item.id),
      label: item.parentId
        ? `${item.name} (con của ${categories.find((c) => c.id === item.parentId)?.name || '—'})`
        : item.name,
    }))
}

export function getCategoryParentName(categories, parentId) {
  if (!parentId) return '—'
  return categories.find((item) => item.id === parentId)?.name || `#${parentId}`
}
