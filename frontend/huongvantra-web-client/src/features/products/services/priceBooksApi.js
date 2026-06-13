import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function trimOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function mapPriceBookEntry(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    priceBookId: item.priceBookId ?? item.PriceBookId,
    skuId: item.skuId ?? item.SkuId ?? null,
    variantId: item.variantId ?? item.VariantId ?? null,
    unitId: item.unitId ?? item.UnitId ?? null,
    price: Number(item.price ?? item.Price ?? 0),
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    startsAt: item.startsAt ?? item.StartsAt ?? '',
    endsAt: item.endsAt ?? item.EndsAt ?? '',
  }
}

export function mapPriceBook(item) {
  if (!item || typeof item !== 'object') return null
  const rawEntries = item.entries ?? item.Entries ?? []
  return {
    id: item.id ?? item.Id,
    code: item.code ?? item.Code ?? '',
    name: item.name ?? item.Name ?? '',
    description: item.description ?? item.Description ?? '',
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    startsAt: item.startsAt ?? item.StartsAt ?? '',
    endsAt: item.endsAt ?? item.EndsAt ?? '',
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    entries: Array.isArray(rawEntries) ? rawEntries.map(mapPriceBookEntry).filter(Boolean) : [],
  }
}

function buildPriceBooksQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.isActive === true || params.isActive === false) search.set('isActive', String(params.isActive))
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

function toApiDateTime(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function buildPriceBookBody(payload) {
  return {
    code: trimOrNull(payload.code),
    name: trimOrNull(payload.name) || '',
    description: trimOrNull(payload.description),
    isActive: payload.isActive !== false,
    startsAt: toApiDateTime(payload.startsAt),
    endsAt: toApiDateTime(payload.endsAt),
    entries: (Array.isArray(payload.entries) ? payload.entries : [])
      .map((entry) => ({
        skuId: entry.targetType === 'sku' ? entry.targetId || null : null,
        variantId: entry.targetType === 'variant' ? entry.targetId || null : null,
        unitId: entry.targetType === 'unit' ? entry.targetId || null : null,
        price: Number(entry.price || 0),
        isActive: entry.isActive !== false,
        startsAt: toApiDateTime(entry.startsAt),
        endsAt: toApiDateTime(entry.endsAt),
      }))
      .filter((entry) => (entry.skuId || entry.variantId || entry.unitId) && numberOrNull(entry.price) !== null),
  }
}

export async function fetchPriceBooks(params = {}) {
  const query = buildPriceBooksQuery(params)
  const data = await apiRequestAuth(`/api/v1/price-books?${query}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapPriceBook).filter(Boolean),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? (Math.ceil(paged.totalCount / paged.pageSize) || 1)),
  }
}

export async function fetchPriceBookById(id) {
  const data = await apiRequestAuth(`/api/v1/price-books/${id}`, { method: 'GET' })
  return mapPriceBook(data)
}

export async function createPriceBook(payload) {
  const data = await apiRequestAuth('/api/v1/price-books', {
    method: 'POST',
    body: JSON.stringify(buildPriceBookBody(payload)),
  })
  return mapPriceBook(data)
}

export async function updatePriceBook(id, payload) {
  const data = await apiRequestAuth(`/api/v1/price-books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildPriceBookBody(payload)),
  })
  return mapPriceBook(data)
}

export async function deletePriceBook(id) {
  return apiRequestAuth(`/api/v1/price-books/${id}`, { method: 'DELETE' })
}
