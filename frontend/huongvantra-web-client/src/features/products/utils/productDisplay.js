export function formatProductPrice(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(amount)
}

export function parseProductPriceInput(raw) {
  const text = String(raw || '')
    .trim()
    .replace(/\s*(đ|vnđ|vnd)\s*$/i, '')
    .replace(/\s/g, '')
  if (!text) return NaN

  const commaPos = text.indexOf(',')
  if (commaPos !== -1) {
    const whole = text.slice(0, commaPos).replace(/\./g, '').replace(/[^\d]/g, '')
    const frac = text.slice(commaPos + 1).replace(/[^\d]/g, '').slice(0, 2)
    if (!whole && !frac) return NaN
    return Number(frac !== '' ? `${whole || '0'}.${frac}` : whole)
  }

  const digits = text.replace(/\./g, '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : NaN
}

export function formatProductPriceInput(raw) {
  const text = String(raw || '')
    .trim()
    .replace(/\s*(đ|vnđ|vnd)\s*$/i, '')
    .replace(/\s/g, '')
  if (!text) return ''

  const endsWithComma = text.endsWith(',')
  const commaPos = text.indexOf(',')
  if (commaPos !== -1) {
    const whole = text.slice(0, commaPos).replace(/\./g, '').replace(/[^\d]/g, '')
    const frac = text.slice(commaPos + 1).replace(/[^\d]/g, '').slice(0, 2)
    const formattedWhole = whole ? Number(whole).toLocaleString('vi-VN') : ''
    if (endsWithComma && !frac) return `${formattedWhole},`
    return frac || endsWithComma ? `${formattedWhole || '0'},${frac}` : formattedWhole
  }

  const digits = text.replace(/\./g, '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('vi-VN')
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

export function getCategoryStatusMeta(isActive) {
  if (isActive) {
    return { label: 'Đang hoạt động', className: 'bg-emerald-50 text-emerald-700' }
  }
  return { label: 'Ngừng hoạt động', className: 'bg-slate-100 text-slate-500' }
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

export function formatStockQuantity(value) {
  const amount = Number(value) || 0
  if (Math.abs(amount - Math.round(amount)) < 0.001) {
    return Math.round(amount).toLocaleString('vi-VN')
  }
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

export function summarizeProductStock(skus = [], stockBySkuId = new Map()) {
  if (!skus.length) {
    return { label: '—', title: '', total: 0, isLow: false, isOut: true }
  }

  const activeSkus = skus.filter((sku) => sku.isActive)
  const list = activeSkus.length ? activeSkus : skus
  const lines = list.map((sku) => ({
    code: sku.skuCode,
    qty: Number(stockBySkuId.get(sku.id) ?? 0),
  }))
  const quantities = lines.map((line) => line.qty)
  const total = quantities.reduce((sum, qty) => sum + qty, 0)
  const min = Math.min(...quantities)
  const max = Math.max(...quantities)
  const label =
    lines.length === 1 || min === max
      ? formatStockQuantity(total)
      : `${formatStockQuantity(min)} – ${formatStockQuantity(max)}`

  return {
    label,
    title: lines.map((line) => `${line.code}: số lượng hiện tại ${formatStockQuantity(line.qty)}`).join('\n'),
    total,
    isLow: quantities.some((qty) => qty > 0 && qty <= 5),
    isOut: quantities.every((qty) => qty <= 0),
  }
}

export function summarizeProductSkus(skus = []) {
  if (!skus.length) {
    return { count: 0, priceLabel: '—', codes: '—', variantsLabel: '—', imageUrl: '' }
  }
  const activeSkus = skus.filter((sku) => sku.isActive)
  const list = activeSkus.length ? activeSkus : skus
  const prices = list.map((sku) => Number(sku.basePrice)).filter(Number.isFinite)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const priceLabel = min === max ? formatProductPrice(min) : `${formatProductPrice(min)} – ${formatProductPrice(max)}`
  const codes = list.map((sku) => sku.skuCode).slice(0, 3).join(', ')
  const variants = list
    .map((sku) => sku.packagingType || sku.skuCode)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')
  return {
    count: skus.length,
    priceLabel,
    codes: skus.length > 3 ? `${codes}…` : codes,
    variantsLabel: list.length > 3 ? `${variants}…` : variants || codes,
    imageUrl: pickProductImageUrl(skus),
  }
}

export function buildProductCatalogLookups({ products = [], skus = [] } = {}) {
  const productById = new Map(products.map((product) => [product.id, product]))
  const skuById = new Map(skus.map((sku) => [sku.id, sku]))
  return { productById, skuById }
}

export function formatProductSnapshotName(productName, packagingType) {
  const name = String(productName || '').trim()
  const packaging = String(packagingType || '').trim()
  if (name && packaging) return `${name} — ${packaging}`
  return name || packaging || 'Sản phẩm'
}

export function resolveOrderLineDisplay(line, { skuById = new Map(), productById = new Map() } = {}) {
  const sku = skuById.get(line.skuId)
  const product = sku ? productById.get(sku.productId) : null
  const snapshotName = String(line.skuSnapshotName || '').trim()
  const snapshotParts = snapshotName.includes(' — ') ? snapshotName.split(' — ') : []
  const productName = product?.name || snapshotParts[0]?.trim() || snapshotName || 'Sản phẩm'
  const packagingType = sku?.packagingType || snapshotParts.slice(1).join(' — ').trim() || ''
  const skuCode = line.skuSnapshotCode || sku?.skuCode || ''
  return {
    productName,
    categoryName: product?.categoryName || sku?.categoryName || '',
    origin: product?.origin || '',
    flavorProfile: product?.flavorProfile || '',
    description: product?.description || '',
    packagingType,
    skuCode,
    weightLabel: sku?.weightInGrams ? formatWeightGrams(sku.weightInGrams) : '',
    imageUrl: sku?.imageUrl || '',
  }
}

export function buildCategoryOptions(categories = [], excludeId = null) {
  return categories
    .filter((item) => item.id !== excludeId)
    .map((item) => ({
      value: String(item.id),
      label: item.name,
    }))
}

export function getCategoryParentName(categories, parentId) {
  if (!parentId) return '—'
  return categories.find((item) => item.id === parentId)?.name || `#${parentId}`
}
