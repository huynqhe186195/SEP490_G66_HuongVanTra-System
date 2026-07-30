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

export function mapRetailPriceChangeRequest(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    requestCode: item.requestCode ?? item.RequestCode ?? '',
    status: item.status ?? item.Status ?? '',
    skuId: item.skuId ?? item.SkuId,
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    productName: item.productName ?? item.ProductName ?? '',
    variantName: item.variantName ?? item.VariantName ?? '',
    currentRetailPrice: Number(item.currentRetailPrice ?? item.CurrentRetailPrice ?? 0),
    requestedRetailPrice: Number(item.requestedRetailPrice ?? item.RequestedRetailPrice ?? 0),
    averageCostPriceAtRequest: numberOrNull(item.averageCostPriceAtRequest ?? item.AverageCostPriceAtRequest),
    reason: item.reason ?? item.Reason ?? '',
    createdBy: item.createdBy ?? item.CreatedBy ?? null,
    createdByName: item.createdByName ?? item.CreatedByName ?? '',
    createdByRoleName: item.createdByRoleName ?? item.CreatedByRoleName ?? '',
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    updatedAt: item.updatedAt ?? item.UpdatedAt ?? null,
    reviewedBy: item.reviewedBy ?? item.ReviewedBy ?? null,
    reviewedByName: item.reviewedByName ?? item.ReviewedByName ?? '',
    reviewedByRoleName: item.reviewedByRoleName ?? item.ReviewedByRoleName ?? '',
    reviewedAt: item.reviewedAt ?? item.ReviewedAt ?? null,
    adminNote: item.adminNote ?? item.AdminNote ?? '',
    rejectReason: item.rejectReason ?? item.RejectReason ?? '',
    appliedRetailPrice: numberOrNull(item.appliedRetailPrice ?? item.AppliedRetailPrice),
    appliedAt: item.appliedAt ?? item.AppliedAt ?? null,
  }
}

export async function fetchRetailPriceChangeRequests(params = {}) {
  const search = new URLSearchParams()
  if (params.status && params.status !== 'all') search.set('status', params.status)
  if (params.search) search.set('search', params.search)
  if (params.mineOnly) search.set('mineOnly', 'true')
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  const data = await apiRequestAuth(`/api/v1/retail-price-change-requests?${search.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return { ...paged, items: paged.items.map(mapRetailPriceChangeRequest).filter(Boolean) }
}

export async function fetchRetailPriceChangeRequestById(id) {
  const data = await apiRequestAuth(`/api/v1/retail-price-change-requests/${id}`, { method: 'GET' })
  return mapRetailPriceChangeRequest(data)
}

export async function createRetailPriceChangeRequest({ skuId, requestedRetailPrice, reason }) {
  const data = await apiRequestAuth('/api/v1/retail-price-change-requests', {
    method: 'POST',
    body: JSON.stringify({
      skuId,
      requestedRetailPrice: Number(requestedRetailPrice ?? 0),
      reason: trimOrNull(reason),
    }),
  })
  return mapRetailPriceChangeRequest(data)
}

export async function approveRetailPriceChangeRequest(id, adminNote = '') {
  const data = await apiRequestAuth(`/api/v1/retail-price-change-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminNote: trimOrNull(adminNote) }),
  })
  return mapRetailPriceChangeRequest(data)
}

export async function rejectRetailPriceChangeRequest(id, reason, adminNote = '') {
  const data = await apiRequestAuth(`/api/v1/retail-price-change-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: String(reason || '').trim(), adminNote: trimOrNull(adminNote) }),
  })
  return mapRetailPriceChangeRequest(data)
}

export async function cancelRetailPriceChangeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/retail-price-change-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: String(reason || '').trim() }),
  })
  return mapRetailPriceChangeRequest(data)
}
