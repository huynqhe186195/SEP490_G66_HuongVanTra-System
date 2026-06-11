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
    orderCount: Number(item.orderCount ?? item.OrderCount ?? 0),
    validityStatus: item.validityStatus ?? item.ValidityStatus ?? base.validityStatus,
    isActive: base.isActive,
  }
}

function buildPromotionPayload(payload) {
  return {
    promoCode: payload.promoCode,
    discountType: payload.discountType || 'PERCENTAGE',
    discountValue: Number(payload.discountValue ?? 0),
    validFrom: payload.validFrom || null,
    validTo: payload.validTo || null,
    isActive: payload.isActive ?? true,
    scopeType: payload.scopeType || 'ORDER',
    skuScopes: Array.isArray(payload.skuScopes) ? payload.skuScopes : [],
  }
}

export async function fetchAdminPromotions() {
  const items = await requestWithAuth('/api/admin/promotions', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapPromotionAdminItem).filter(Boolean) : []
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
