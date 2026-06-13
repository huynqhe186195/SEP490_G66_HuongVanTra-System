import { loadAuthSession } from '../../auth/services/authSession.js'
import { parseResponseError } from '../../../lib/apiClient.js'
import { mapPromotion } from '../../pos/utils/posPromotionUtils.js'

const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function requestWithAuth(path, options = {}) {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${session.accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response))
  }

  if (response.status === 204) return null
  return response.json()
}

function mapPromotionAdminItem(item) {
  const base = mapPromotion(item)
  if (!base) return null
  return {
    ...base,
    categoryScopes: mapPromotionCategoryScopes(item),
    customerTierScopes: mapPromotionCustomerTierScopes(item),
    orderCount: Number(item.orderCount ?? item.OrderCount ?? 0),
    validityStatus: normalizePromotionValidityStatus(
      item.validityStatus ?? item.ValidityStatus ?? base.validityStatus,
    ),
    isActive: base.isActive,
  }
}

function normalizePromotionValidityStatus(status) {
  const value = String(status || '').trim().toUpperCase()
  if (!value || value === 'UNLIMITED') return 'ACTIVE'
  if (value === 'DEACTIVATED') return 'INACTIVE'
  if (value === 'NOT_STARTED') return 'SCHEDULED'
  if (['ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED'].includes(value)) return value
  return value
}

function mapPromotionCategoryScopes(item) {
  const rawScopes = item?.categoryScopes ?? item?.CategoryScopes ?? []
  if (!Array.isArray(rawScopes)) return []

  return rawScopes
    .map((scope) => ({
      categoryId: scope.categoryId ?? scope.CategoryId ?? null,
      categoryName:
        scope.categoryName ??
        scope.CategoryName ??
        scope.categorySnapshotName ??
        scope.CategorySnapshotName ??
        '',
    }))
    .filter((scope) => scope.categoryId)
}

function mapPromotionCustomerTierScopes(item) {
  const rawScopes = item?.customerTierScopes ?? item?.CustomerTierScopes ?? []
  if (!Array.isArray(rawScopes)) return []

  return rawScopes
    .map((scope) => {
      const tierId = Number(scope.tierId ?? scope.TierId ?? 0)
      const tierName =
        scope.tierName ??
        scope.TierName ??
        scope.tierSnapshotName ??
        scope.TierSnapshotName ??
        (tierId > 0 ? `Hạng #${tierId}` : '')

      return { tierId, tierName }
    })
    .filter((scope) => scope.tierId > 0)
}

function buildPromotionPayload(payload) {
  const scopeType = String(payload.scopeType || 'ORDER').toUpperCase()
  return {
    promoCode: payload.promoCode,
    discountType: payload.discountType || 'PERCENTAGE',
    discountValue: Number(payload.discountValue ?? 0),
    maxDiscountAmount:
      payload.discountType === 'PERCENTAGE'
        ? Number(payload.maxDiscountAmount || 0)
        : null,
    minimumOrderAmount: Number(payload.minimumOrderAmount || 0),
    usageLimitTotal: Number(payload.usageLimitTotal || 0),
    usageLimitPerCustomer: Number(payload.usageLimitPerCustomer || 0),
    validFrom: payload.validFrom || null,
    validTo: payload.validTo || null,
    isActive: payload.isActive ?? true,
    scopeType,
    skuScopes: scopeType === 'SKU' ? payload.skuScopes ?? [] : [],
    categoryScopes: scopeType === 'CATEGORY' ? payload.categoryScopes ?? [] : [],
    customerTierScopes: payload.customerTierScopes ?? [],
  }
}

function buildAdminPromotionQuery(params = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('pageSize', String(params.pageSize || 10))

  const search = String(params.search || '').trim()
  if (search) query.set('search', search)

  for (const key of ['discountType', 'scopeType', 'status']) {
    const value = String(params[key] || '').trim()
    if (value && value !== 'ALL') query.set(key, value)
  }

  return query.toString()
}

function mapPagedPromotionsResponse(data, fallbackPage = 1, fallbackPageSize = 10) {
  if (Array.isArray(data)) {
    const items = data.map(mapPromotionAdminItem).filter(Boolean)
    return {
      items,
      page: fallbackPage,
      pageSize: fallbackPageSize,
      totalItems: items.length,
      totalPages: 1,
    }
  }

  const rawItems = data?.items ?? data?.Items ?? []
  const page = Number(data?.page ?? data?.Page ?? fallbackPage)
  const pageSize = Number(data?.pageSize ?? data?.PageSize ?? fallbackPageSize)
  const totalItems = Number(
    data?.totalItems ??
      data?.TotalItems ??
      data?.totalCount ??
      data?.TotalCount ??
      rawItems.length,
  )
  const totalPages = Number(
    data?.totalPages ??
      data?.TotalPages ??
      Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize))),
  )

  return {
    items: Array.isArray(rawItems) ? rawItems.map(mapPromotionAdminItem).filter(Boolean) : [],
    page,
    pageSize,
    totalItems,
    totalPages,
  }
}

export async function fetchAdminPromotions(params = {}) {
  const page = Number(params.page || 1)
  const pageSize = Number(params.pageSize || 10)
  const query = buildAdminPromotionQuery({ ...params, page, pageSize })
  const data = await requestWithAuth(`/api/admin/promotions?${query}`, { method: 'GET' })
  return mapPagedPromotionsResponse(data, page, pageSize)
}

export async function createAdminPromotion(payload) {
  const item = await requestWithAuth('/api/admin/promotions', {
    method: 'POST',
    body: JSON.stringify(buildPromotionPayload(payload)),
  })
  return mapPromotionAdminItem(item)
}

export async function updateAdminPromotion(id, payload) {
  const item = await requestWithAuth(`/api/admin/promotions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildPromotionPayload(payload)),
  })
  return mapPromotionAdminItem(item)
}

export async function deactivateAdminPromotion(id) {
  const item = await requestWithAuth(`/api/admin/promotions/${id}`, { method: 'DELETE' })
  return mapPromotionAdminItem(item)
}

export async function reactivateAdminPromotion(id) {
  const item = await requestWithAuth(`/api/admin/promotions/${id}/reactivate`, { method: 'POST' })
  return mapPromotionAdminItem(item)
}
