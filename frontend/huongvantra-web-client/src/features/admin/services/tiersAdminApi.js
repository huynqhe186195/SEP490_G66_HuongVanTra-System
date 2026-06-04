import { loadAuthSession } from '../../auth/services/authSession.js'
import { mapMembershipTier } from '../../customers/utils/membershipTierUtils.js'

const DEFAULT_API_BASE_URL = 'http://localhost:5249'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
}

async function parseResponseError(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null)
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) return body.message
    }
  }
  const text = await response.text().catch(() => '')
  return text.trim() || 'Có lỗi xảy ra.'
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

function mapTierAdminItem(item) {
  const base = mapMembershipTier(item)
  if (!base) return null
  return {
    ...base,
    customerCount: Number(item.customerCount ?? item.CustomerCount ?? 0),
  }
}

export async function fetchAdminMembershipTiers() {
  const items = await requestWithAuth('/api/admin/membership-tiers', { method: 'GET' })
  return Array.isArray(items) ? items.map(mapTierAdminItem).filter(Boolean) : []
}

export async function createAdminMembershipTier(payload) {
  const item = await requestWithAuth('/api/admin/membership-tiers', {
    method: 'POST',
    body: JSON.stringify({
      tierCode: payload.tierCode,
      minTotalSpend: Number(payload.minTotalSpend ?? 0),
      discountPercent: Number(payload.discountPercent ?? 0),
    }),
  })
  return mapTierAdminItem(item)
}

export async function updateAdminMembershipTier(id, payload) {
  const item = await requestWithAuth(`/api/admin/membership-tiers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      tierCode: payload.tierCode,
      minTotalSpend: Number(payload.minTotalSpend ?? 0),
      discountPercent: Number(payload.discountPercent ?? 0),
    }),
  })
  return mapTierAdminItem(item)
}

export async function deactivateAdminMembershipTier(id) {
  const item = await requestWithAuth(`/api/admin/membership-tiers/${id}`, { method: 'DELETE' })
  return mapTierAdminItem(item)
}

export async function reactivateAdminMembershipTier(id) {
  const item = await requestWithAuth(`/api/admin/membership-tiers/${id}/reactivate`, { method: 'POST' })
  return mapTierAdminItem(item)
}
