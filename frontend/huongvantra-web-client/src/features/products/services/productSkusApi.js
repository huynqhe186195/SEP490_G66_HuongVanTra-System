import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapProductSku, mapSupplierReceiptSku } from './productsApi.js'

function trimOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildSkuQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.productId) search.set('productId', String(params.productId))
  if (params.isActive === true || params.isActive === false) search.set('isActive', String(params.isActive))
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

export async function fetchSkus(params = {}) {
  const query = buildSkuQuery(params)
  const data = await apiRequestAuth(`/api/v1/skus?${query}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapProductSku).filter(Boolean),
  }
}

export async function fetchAllActiveSkus(pageSize = 100) {
  const items = []
  let page = 1
  let totalCount = 0

  do {
    const result = await fetchSkus({ isActive: true, page, pageSize })
    items.push(...result.items)
    totalCount = result.totalCount ?? items.length
    if (result.items.length < pageSize) break
    page += 1
  } while (items.length < totalCount)

  return items
}

function mapAccountingCostProfitSku(item) {
  if (!item || typeof item !== 'object') return null
  return {
    skuId: item.skuId ?? item.SkuId,
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    productName: item.productName ?? item.ProductName ?? '',
    variantName: item.variantName ?? item.VariantName ?? '',
    unitName: item.unitName ?? item.UnitName ?? '',
    retailPrice: Number(item.retailPrice ?? item.RetailPrice ?? 0),
    averageCostPrice: Number(item.averageCostPrice ?? item.AverageCostPrice ?? 0),
    lastPurchaseUnitCost: numberOrNull(item.lastPurchaseUnitCost ?? item.LastPurchaseUnitCost),
    sourceReceiptId: item.sourceReceiptId ?? item.SourceReceiptId ?? null,
    sourceReceiptCode: item.sourceReceiptCode ?? item.SourceReceiptCode ?? '',
    sourceApprovedAt: item.sourceApprovedAt ?? item.SourceApprovedAt ?? null,
    costUpdatedAt: item.costUpdatedAt ?? item.CostUpdatedAt ?? null,
  }
}

export async function fetchAccountingCostProfitSkus() {
  const data = await apiRequestAuth('/api/v1/skus/accounting-cost-profit', { method: 'GET' })
  const items = Array.isArray(data) ? data : (data?.items ?? data?.Items ?? [])
  return items.map(mapAccountingCostProfitSku).filter(Boolean)
}

export async function updateAccountingRetailPrice(skuId, retailPrice) {
  const data = await apiRequestAuth(`/api/v1/skus/${skuId}/retail-price`, {
    method: 'PATCH',
    body: JSON.stringify({ retailPrice: Number(retailPrice) }),
  })
  return mapAccountingCostProfitSku(data)
}

function mapPriceHistoryItem(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    type: item.type ?? item.Type ?? '',
    oldValue: Number(item.oldValue ?? item.OldValue ?? 0),
    newValue: Number(item.newValue ?? item.NewValue ?? 0),
    incomingUnitCost: numberOrNull(item.incomingUnitCost ?? item.IncomingUnitCost),
    sourceType: item.sourceType ?? item.SourceType ?? '',
    sourceReceiptId: item.sourceReceiptId ?? item.SourceReceiptId ?? null,
    sourceReceiptCode: item.sourceReceiptCode ?? item.SourceReceiptCode ?? '',
    changedBy: item.changedBy ?? item.ChangedBy ?? '',
    changedAt: item.changedAt ?? item.ChangedAt ?? null,
    wasApplied: item.wasApplied ?? item.WasApplied ?? null,
    processingResult: item.processingResult ?? item.ProcessingResult ?? '',
    sourceApprovedAt: item.sourceApprovedAt ?? item.SourceApprovedAt ?? null,
    updatedAt: item.updatedAt ?? item.UpdatedAt ?? null,
  }
}

export async function fetchSkuPriceHistory(skuId, { page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const data = await apiRequestAuth(`/api/v1/skus/${skuId}/price-history?${params.toString()}`, { method: 'GET' })
  return {
    items: (data.items ?? data.Items ?? []).map(mapPriceHistoryItem).filter(Boolean),
    page: Number(data.page ?? data.Page ?? page),
    pageSize: Number(data.pageSize ?? data.PageSize ?? pageSize),
    totalCount: Number(data.totalCount ?? data.TotalCount ?? 0),
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1),
  }
}

export async function fetchSupplierReceiptSkus() {
  const data = await apiRequestAuth('/api/v1/skus/supplier-receipt-catalog', { method: 'GET' })
  const items = getSupplierReceiptCatalogItems(data)
  return items.map(mapSupplierReceiptSku).filter(Boolean)
}

function getSupplierReceiptCatalogItems(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.Items)) return response.Items
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.Data)) return response.Data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.Data?.Items)) return response.Data.Items

  throw new Error('Dữ liệu danh sách SKU được phép nhập từ nhà cung cấp không hợp lệ.')
}

/** SKU cho Admin/Manager — gọi endpoint riêng, luôn trả catalog cửa hàng. */
export async function fetchStoreSkus(params = {}) {
  const query = buildSkuQuery(params)
  const data = await apiRequestAuth(`/api/v1/store/skus?${query}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapProductSku).filter(Boolean),
  }
}

export async function fetchAllActiveStoreSkus(pageSize = 100) {
  const items = []
  let page = 1
  let totalCount = 0

  do {
    const result = await fetchStoreSkus({ isActive: true, page, pageSize })
    items.push(...result.items)
    totalCount = result.totalCount ?? items.length
    if (result.items.length < pageSize) break
    page += 1
  } while (items.length < totalCount)

  return items
}

export async function fetchSkusByProductId(productId) {
  const data = await apiRequestAuth(`/api/v1/skus/by-product/${productId}`, { method: 'GET' })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapProductSku).filter(Boolean)
}

/** SKU theo product — catalog cửa hàng (Admin/Manager/Sale). */
export async function fetchStoreSkusByProductId(productId) {
  const data = await apiRequestAuth(`/api/v1/store/skus/by-product/${productId}`, { method: 'GET' })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapProductSku).filter(Boolean)
}

export async function fetchSkuById(id) {
  const data = await apiRequestAuth(`/api/v1/skus/${id}`, { method: 'GET' })
  return mapProductSku(data)
}

export function buildCreateSkuBody(payload) {
  return {
    productId: payload.productId,
    skuCode: String(payload.skuCode || '').trim().toUpperCase(),
    barcode: trimOrNull(payload.barcode),
    packagingType: payload.packagingType?.trim(),
    weightInGrams: Number(payload.weightInGrams),
    basePrice: Number(payload.basePrice),
    costPrice: numberOrNull(payload.costPrice),
    retailPrice: numberOrNull(payload.retailPrice),
    minStock: numberOrNull(payload.minStock),
    maxStock: numberOrNull(payload.maxStock),
    isSellable: payload.isSellable !== false,
    allowRewardPoints: payload.allowRewardPoints !== false,
    imageUrl: trimOrNull(payload.imageUrl),
  }
}

export function buildUpdateSkuBody(payload) {
  return {
    skuCode: String(payload.skuCode || '').trim().toUpperCase(),
    barcode: trimOrNull(payload.barcode),
    packagingType: payload.packagingType?.trim(),
    weightInGrams: Number(payload.weightInGrams),
    basePrice: Number(payload.basePrice),
    costPrice: numberOrNull(payload.costPrice),
    retailPrice: numberOrNull(payload.retailPrice),
    minStock: numberOrNull(payload.minStock),
    maxStock: numberOrNull(payload.maxStock),
    isSellable: payload.isSellable !== false,
    allowRewardPoints: payload.allowRewardPoints !== false,
    imageUrl: trimOrNull(payload.imageUrl),
    isActive: Boolean(payload.isActive),
  }
}

export async function createSku(payload) {
  const data = await apiRequestAuth('/api/v1/skus', {
    method: 'POST',
    body: JSON.stringify(buildCreateSkuBody(payload)),
  })
  return mapProductSku(data)
}

export async function updateSku(id, payload) {
  const data = await apiRequestAuth(`/api/v1/skus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdateSkuBody(payload)),
  })
  return mapProductSku(data)
}

export async function deleteSku(id) {
  return apiRequestAuth(`/api/v1/skus/${id}`, { method: 'DELETE' })
}
