import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapReturnInspection(row) {
  return {
    id: row.id ?? row.Id,
    returnId: row.returnId ?? row.ReturnId,
    returnCode: row.returnCode ?? row.ReturnCode ?? '',
    orderId: row.orderId ?? row.OrderId,
    orderCode: row.orderCode ?? row.OrderCode ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    disposition: String(row.disposition ?? row.Disposition ?? 'Pending'),
    quarantineBatchId: row.quarantineBatchId ?? row.QuarantineBatchId ?? null,
    restockBatchId: row.restockBatchId ?? row.RestockBatchId ?? null,
    inspectedBy: row.inspectedBy ?? row.InspectedBy ?? null,
    inspectedAt: row.inspectedAt ?? row.InspectedAt ?? null,
    inspectionNote: row.inspectionNote ?? row.InspectionNote ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
  }
}

export const RETURN_DISPOSITIONS = ['RestockApproved', 'Quarantined', 'Disposed']

export function getDispositionLabel(disposition) {
  const key = String(disposition || '').toLowerCase()
  if (key === 'pending') return 'Chờ kiểm tra'
  if (key === 'restockapproved') return 'Duyệt nhập lại'
  if (key === 'quarantined') return 'Kiểm dịch'
  if (key === 'disposed') return 'Tiêu hủy'
  return disposition || '—'
}

export function getDispositionClass(disposition) {
  const key = String(disposition || '').toLowerCase()
  if (key === 'restockapproved') return 'bg-emerald-50 text-emerald-700'
  if (key === 'quarantined') return 'bg-amber-50 text-amber-700'
  if (key === 'disposed') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function buildQuery({ disposition, search, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams()
  if (disposition) params.set('disposition', disposition)
  if (search?.trim()) params.set('search', search.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchReturnInspections(params = {}) {
  const data = await apiRequestAuth(
    `/api/v1/inventory/return-inspections${buildQuery(params)}`,
    { method: 'GET' },
  )
  const paged = toPagedResult(data)
  return { ...paged, items: paged.items.map(mapReturnInspection) }
}

export async function fetchReturnInspectionsByReturnId(returnId) {
  const data = await apiRequestAuth(
    `/api/v1/inventory/return-inspections/by-return/${returnId}`,
    { method: 'GET' },
  )
  return (Array.isArray(data) ? data : []).map(mapReturnInspection)
}

export async function inspectReturn(id, { disposition, note } = {}) {
  const data = await apiRequestAuth(
    `/api/v1/inventory/return-inspections/${id}/inspect`,
    {
      method: 'POST',
      body: JSON.stringify({ disposition, note: note?.trim() || null }),
    },
  )
  return mapReturnInspection(data)
}
