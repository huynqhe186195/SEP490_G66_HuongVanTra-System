import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapRequest(row) {
  return {
    id: row.id ?? row.Id,
    requestCode: row.requestCode ?? row.RequestCode ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantityDelta: Number(row.quantityDelta ?? row.QuantityDelta ?? 0),
    reason: row.reason ?? row.Reason ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    quantityOnHandSnapshot: Number(row.quantityOnHandSnapshot ?? row.QuantityOnHandSnapshot ?? 0),
    quantityOnHandAfter: row.quantityOnHandAfter ?? row.QuantityOnHandAfter ?? null,
    requestedBy: row.requestedBy ?? row.RequestedBy,
    requestedAt: row.requestedAt ?? row.RequestedAt ?? null,
    reviewedBy: row.reviewedBy ?? row.ReviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? row.ReviewedAt ?? null,
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    exportSlipId: row.exportSlipId ?? row.ExportSlipId ?? null,
    exportSlipCode: row.exportSlipCode ?? row.ExportSlipCode ?? '',
  }
}

export function getAdjustmentStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'pending') return 'Chờ duyệt'
  if (key === 'approved') return 'Đã duyệt'
  if (key === 'rejected') return 'Từ chối'
  if (key === 'cancelled') return 'Đã hủy'
  return status || '—'
}

export function getAdjustmentStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'pending') return 'bg-amber-100 text-amber-800'
  if (key === 'approved') return 'bg-emerald-100 text-emerald-800'
  if (key === 'rejected') return 'bg-rose-100 text-rose-800'
  if (key === 'cancelled') return 'bg-slate-100 text-slate-600'
  return 'bg-slate-100 text-slate-600'
}

export async function fetchStockAdjustmentRequests({ status, mine, search } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (mine) params.set('mine', 'true')
  if (search?.trim()) params.set('search', search.trim())
  const query = params.toString()
  const path = `/api/v1/inventory/stock-adjustment-requests${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapRequest)
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
  return {
    exportSlipId: data?.exportSlipId ?? data?.ExportSlipId ?? null,
    exportSlipCode: data?.exportSlipCode ?? data?.ExportSlipCode ?? '',
    quantityOnHandAfter: data?.quantityOnHandAfter ?? data?.QuantityOnHandAfter ?? null,
    warehouseQuantityOnHandAfter:
      data?.warehouseQuantityOnHandAfter ?? data?.WarehouseQuantityOnHandAfter ?? null,
  }
}

export async function rejectStockAdjustmentRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return data
}

export async function cancelStockAdjustmentRequest(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-adjustment-requests/${id}/cancel`, {
    method: 'POST',
  })
  return data
}
