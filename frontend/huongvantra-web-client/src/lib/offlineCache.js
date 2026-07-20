import { apiRequestAuth } from './apiClient.js'
import { cacheProducts, cacheCustomers, setMeta } from './offlineDb.js'
import { toPagedResult } from './apiClient.js'
import { loadAuthSession } from '../features/auth/services/authSession.js'
import { isWarehouseRole } from '../features/auth/utils/permissions.js'

// ── Sync products + SKUs + stock into IndexedDB ──────────────────────────────

function catalogPaths() {
  const warehouse = isWarehouseRole(loadAuthSession())
  return {
    skus: warehouse ? '/api/v1/skus' : '/api/v1/store/skus',
    products: warehouse ? '/api/v1/products' : '/api/v1/store/products',
    stocks: warehouse ? '/api/v1/inventory/sku-stocks' : '/api/v1/store/sku-stocks',
  }
}

async function fetchAllSkus() {
  const { skus: base } = catalogPaths()
  const pageSize = 100
  let page = 1
  let all = []
  let total
  do {
    const data = await apiRequestAuth(
      `${base}?page=${page}&pageSize=${pageSize}&isActive=true`,
      { method: 'GET' }
    )
    const paged = toPagedResult(data)
    const items = paged.items ?? []
    all = all.concat(items)
    total = paged.totalCount ?? 0
    if (items.length === 0) break
    page++
  } while (all.length < total && page <= 50)
  return all
}

async function fetchAllProducts() {
  const { products: base } = catalogPaths()
  const pageSize = 100
  let page = 1
  let all = []
  let total
  do {
    const data = await apiRequestAuth(
      `${base}?page=${page}&pageSize=${pageSize}`,
      { method: 'GET' }
    )
    const paged = toPagedResult(data)
    const items = paged.items ?? []
    all = all.concat(items)
    total = paged.totalCount ?? 0
    if (items.length === 0) break
    page++
  } while (all.length < total && page <= 50)
  return all
}

async function fetchAllStocks() {
  try {
    const { stocks } = catalogPaths()
    const data = await apiRequestAuth(stocks, { method: 'GET' })
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function fetchAllCustomers() {
  const pageSize = 100
  let page = 1
  let all = []
  let total
  do {
    const data = await apiRequestAuth(
      `/api/customers?page=${page}&pageSize=${pageSize}`,
      { method: 'GET' }
    )
    const paged = toPagedResult(data)
    const items = paged.items ?? []
    all = all.concat(items)
    total = paged.totalCount ?? 0
    if (items.length === 0) break
    page++
  } while (all.length < total && page <= 100)
  return all
}

const CUSTOMER_PERMISSIONS = new Set(['VIEW_CUSTOMER', 'VIEW_ALL_CUSTOMERS', 'CREATE_CUSTOMER'])

function canViewCustomers(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.some(p => CUSTOMER_PERMISSIONS.has(p))
}

// ── Main sync function — called on "Chuẩn bị offline" or background timer ───

export async function syncOfflineCache({ permissions = [] } = {}) {
  const safe = fn => fn().catch(e => { console.warn('[offline-sync]', e.message); return [] })

  const shouldSyncCustomers = canViewCustomers(permissions)

  const [skus, products, stocks, customers] = await Promise.all([
    safe(fetchAllSkus),
    safe(fetchAllProducts),
    safe(fetchAllStocks),
    shouldSyncCustomers ? safe(fetchAllCustomers) : Promise.resolve([]),
  ])

  const productById = new Map(
    products.map(p => [p.id ?? p.Id, p])
  )
  const stockBySkuId = new Map(
    stocks.map(s => [s.skuId ?? s.SkuId, Number(s.quantityOnHand ?? s.QuantityOnHand ?? 0)])
  )

  const mappedSkus = skus
    .map(sku => {
      const skuId = sku.id ?? sku.Id
      if (!skuId) return null
      const product = productById.get(sku.productId ?? sku.ProductId)
      return {
        skuId,
        skuCode: sku.skuCode ?? sku.SkuCode ?? '',
        name: sku.productName ?? sku.ProductName ?? product?.name ?? product?.Name ?? '',
        price: sku.basePrice ?? sku.BasePrice ?? sku.retailPrice ?? sku.RetailPrice ?? 0,
        unit: sku.packagingType ?? sku.PackagingType ?? '',
        productType: sku.productType ?? sku.ProductType ?? product?.productType ?? product?.ProductType ?? '',
        inventoryUnit: sku.inventoryUnit ?? sku.InventoryUnit ?? product?.inventoryUnit ?? product?.InventoryUnit ?? '',
        isSellable: Boolean(sku.isSellable ?? sku.IsSellable ?? product?.isSellable ?? product?.IsSellable ?? true),
        priceUnit: sku.priceUnit ?? sku.PriceUnit ?? product?.priceUnit ?? product?.PriceUnit ?? sku.inventoryUnit ?? sku.InventoryUnit ?? '',
        imageUrl: sku.imageUrl ?? sku.ImageUrl ?? product?.imageUrl ?? product?.ImageUrl ?? '',
        categoryId: sku.categoryId ?? sku.CategoryId ?? product?.categoryId ?? product?.CategoryId ?? null,
        qtyOnHand: stockBySkuId.get(skuId) ?? 0,
        isActive: 1,
      }
    })
    .filter(Boolean)

  const mappedCustomers = customers.map(c => ({
    customerId: c.id ?? c.customerId ?? c.CustomerId,
    name: c.fullName ?? c.name ?? c.Name ?? '',
    phone: c.phoneNumber ?? c.phone ?? c.Phone ?? '',
    debtBalance: Number(c.currentDebt ?? c.debtBalance ?? 0),
    tierId: c.tierId ?? null,
    tierName: c.tierName ?? c.membershipTierName ?? '',
    tierDiscountPercent: Number(c.tierDiscountPercent ?? 0),
    customerType: c.customerType ?? c.CustomerType ?? 'RETAIL',
  }))

  await Promise.all([
    cacheProducts(mappedSkus),
    cacheCustomers(mappedCustomers),
  ])

  await setMeta('isOfflineReady', true)

  window.dispatchEvent(new CustomEvent('hvt-offline-cache-updated'))
}
