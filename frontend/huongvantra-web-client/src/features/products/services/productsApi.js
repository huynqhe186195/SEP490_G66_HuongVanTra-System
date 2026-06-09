import { apiRequest, apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapProductSku(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    productId: item.productId ?? item.ProductId,
    productName: item.productName ?? item.ProductName ?? '',
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    packagingType: item.packagingType ?? item.PackagingType ?? '',
    weightInGrams: Number(item.weightInGrams ?? item.WeightInGrams ?? 0),
    basePrice: Number(item.basePrice ?? item.BasePrice ?? 0),
    imageUrl: item.imageUrl ?? item.ImageUrl ?? '',
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export function mapProduct(item) {
  if (!item || typeof item !== 'object') return null
  const rawSkus = item.skus ?? item.Skus ?? []
  const skus = Array.isArray(rawSkus) ? rawSkus.map(mapProductSku).filter(Boolean) : []
  return {
    id: item.id ?? item.Id,
    categoryId: item.categoryId ?? item.CategoryId,
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    name: item.name ?? item.Name ?? '',
    origin: item.origin ?? item.Origin ?? '',
    flavorProfile: item.flavorProfile ?? item.FlavorProfile ?? '',
    brewingGuide: item.brewingGuide ?? item.BrewingGuide ?? '',
    description: item.description ?? item.Description ?? '',
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    skus,
  }
}

function buildProductQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.categoryId) search.set('categoryId', String(params.categoryId))
  if (params.isActive === true || params.isActive === false) search.set('isActive', String(params.isActive))
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

export async function fetchProducts(params = {}) {
  const query = buildProductQuery(params)
  const data = await apiRequest(`/api/v1/products?${query}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapProduct).filter(Boolean),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? (Math.ceil(paged.totalCount / paged.pageSize) || 1)),
  }
}

export async function fetchProductById(id) {
  const data = await apiRequest(`/api/v1/products/${id}`, { method: 'GET' })
  return mapProduct(data)
}

export function buildCreateProductBody(payload) {
  return {
    categoryId: Number(payload.categoryId),
    name: payload.name?.trim(),
    origin: payload.origin?.trim() || null,
    flavorProfile: payload.flavorProfile?.trim() || null,
    brewingGuide: payload.brewingGuide?.trim() || null,
    description: payload.description?.trim() || null,
  }
}

export function buildUpdateProductBody(payload) {
  return {
    ...buildCreateProductBody(payload),
    isActive: Boolean(payload.isActive),
  }
}

export async function createProduct(payload) {
  const data = await apiRequestAuth('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(buildCreateProductBody(payload)),
  })
  return mapProduct(data)
}

export async function updateProduct(id, payload) {
  const data = await apiRequestAuth(`/api/v1/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdateProductBody(payload)),
  })
  return mapProduct(data)
}

export async function deleteProduct(id) {
  return apiRequestAuth(`/api/v1/products/${id}`, { method: 'DELETE' })
}

export async function setProductStatus(product, isActive) {
  return updateProduct(product.id, {
    categoryId: product.categoryId,
    name: product.name,
    origin: product.origin || '',
    flavorProfile: product.flavorProfile || '',
    brewingGuide: product.brewingGuide || '',
    description: product.description || '',
    isActive,
  })
}
