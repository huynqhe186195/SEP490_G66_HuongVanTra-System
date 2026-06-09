import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapProductSku } from './productsApi.js'

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

export async function fetchSkusByProductId(productId) {
  const data = await apiRequestAuth(`/api/v1/skus/by-product/${productId}`, { method: 'GET' })
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
    packagingType: payload.packagingType?.trim(),
    weightInGrams: Number(payload.weightInGrams),
    basePrice: Number(payload.basePrice),
    imageUrl: payload.imageUrl?.trim() || null,
  }
}

export function buildUpdateSkuBody(payload) {
  return {
    skuCode: String(payload.skuCode || '').trim().toUpperCase(),
    packagingType: payload.packagingType?.trim(),
    weightInGrams: Number(payload.weightInGrams),
    basePrice: Number(payload.basePrice),
    imageUrl: payload.imageUrl?.trim() || null,
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
