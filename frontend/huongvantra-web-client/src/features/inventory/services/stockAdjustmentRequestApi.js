import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapRequestItem(row) {
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantityDelta: Number(row.quantityDelta ?? row.QuantityDelta ?? 0),
    quantityOnHandSnapshot: Number(row.quantityOnHandSnapshot ?? row.QuantityOnHandSnapshot ?? 0),
    quantityOnHandAfter: row.quantityOnHandAfter ?? row.QuantityOnHandAfter ?? null,
    warehouseQuantityOnHandAfter:
      row.warehouseQuantityOnHandAfter ?? row.WarehouseQuantityOnHandAfter ?? null,
    exportSlipId: row.exportSlipId ?? row.ExportSlipId ?? null,
    exportSlipCode: row.exportSlipCode ?? row.ExportSlipCode ?? '',
  }
}

function mapRequest(row) {
  const items = (row.items ?? row.Items ?? []).map(mapRequestItem)
  return {
    id: row.id ?? row.Id,
    requestCode: row.requestCode ?? row.RequestCode ?? '',
    reason: row.reason ?? row.Reason ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    requestedBy: row.requestedBy ?? row.RequestedBy,
    requestedAt: row.requestedAt ?? row.RequestedAt ?? null,
    reviewedBy: row.reviewedBy ?? row.ReviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? row.ReviewedAt ?? null,
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    items,
    itemCount: items.length,
    totalDelta: items.reduce((sum, item) => sum + item.quantityDelta, 0),
    hasIncrease: items.some((item) => item.quantityDelta > 0),
    hasDecrease: items.some((item) => item.quantityDelta < 0),
    exportSlipCodes: items.map((item) => item.exportSlipCode).filter(Boolean),
  }
}

export function getAdjustmentStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'pending') return 'Chờ duyệt'
  if (key === 'approved') return 'Đã duyệt'
  if (key === 'completed') return 'Hoàn tất'
  if (key === 'rejected') return 'Từ chối'
  if (key === 'cancelled') return 'Đã hủy'
  return status || '—'
}

export function getAdjustmentStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'pending') return 'bg-amber-100 text-amber-800'
  if (key === 'approved' || key === 'completed') return 'bg-emerald-100 text-emerald-800'
  if (key === 'rejected') return 'bg-rose-100 text-rose-800'
  if (key === 'cancelled') return 'bg-slate-100 text-slate-600'
  return 'bg-slate-100 text-slate-600'
}

export async function fetchStockAdjustmentRequestById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}`, {
    method: 'GET',
  })
  return mapRequest(data)
}

export async function fetchStockAdjustmentRequests({ status, mine, search, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (mine) params.set('mine', 'true')
  if (search?.trim()) params.set('search', search.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const query = params.toString()
  const path = `/api/v1/inventory/stock-adjustment-requests${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (Array.isArray(data)) {
    return {
      items: data.map(mapRequest),
      page,
      pageSize,
      totalCount: data.length,
    }
  }

  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapRequest),
  }
}

export async function createStockAdjustmentRequest(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/stock-adjustment-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapRequest(data)
}

export async function approveStockAdjustmentRequest(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/approve`, {
    method: 'POST',
  })
  const exportSlips = (data?.exportSlips ?? data?.ExportSlips ?? []).map((row) => ({
    exportSlipId: row.exportSlipId ?? row.ExportSlipId ?? null,
    exportSlipCode: row.exportSlipCode ?? row.ExportSlipCode ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
  }))
  return {
    id: data?.id ?? data?.Id,
    requestCode: data?.requestCode ?? data?.RequestCode ?? '',
    status: String(data?.status ?? data?.Status ?? '').toLowerCase(),
    reviewedAt: data?.reviewedAt ?? data?.ReviewedAt ?? null,
    exportSlips,
  }
}

export async function rejectStockAdjustmentRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return data
}

export async function cancelStockAdjustmentRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return data
}
