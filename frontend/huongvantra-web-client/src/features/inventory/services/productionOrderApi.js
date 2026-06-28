import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapProductionOrderLine(row) {
  if (!row) return null
  return {
    id: row.id ?? row.Id,
    materialSkuId: row.materialSkuId ?? row.MaterialSkuId,
    materialSkuCode: row.materialSkuCode ?? row.MaterialSkuCode ?? '',
    materialSnapshotName: row.materialSnapshotName ?? row.MaterialSnapshotName ?? '',
    plannedQuantity: Number(row.plannedQuantity ?? row.PlannedQuantity ?? 0),
  }
}

export function mapProductionOrder(row) {
  if (!row) return null
  return {
    id: row.id ?? row.Id,
    productionCode: row.productionCode ?? row.ProductionCode ?? '',
    finishedSkuId: row.finishedSkuId ?? row.FinishedSkuId,
    finishedSkuCode: row.finishedSkuCode ?? row.FinishedSkuCode ?? '',
    finishedSkuSnapshotName: row.finishedSkuSnapshotName ?? row.FinishedSkuSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    note: row.note ?? row.Note ?? null,
    status: row.status ?? row.Status ?? 'Draft',
    createdBy: row.createdBy ?? row.CreatedBy,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    completedAt: row.completedAt ?? row.CompletedAt ?? null,
    lines: (row.lines ?? row.Lines ?? []).map(mapProductionOrderLine).filter(Boolean),
  }
}

export const PRODUCTION_STATUS_LABEL = {
  Draft: 'Nháp',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
}

export const PRODUCTION_STATUS_CLASS = {
  Draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  Completed: 'bg-green-50 text-green-700 border border-green-200',
  Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
}

export async function fetchProductionOrders({ status, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  const data = await apiRequestAuth(`/api/v1/inventory/production-orders?${params}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapProductionOrder).filter(Boolean),
  }
}

export async function fetchProductionOrderById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/production-orders/${id}`, { method: 'GET' })
  return mapProductionOrder(data)
}

export async function createProductionOrder(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/production-orders', {
    method: 'POST',
    body: JSON.stringify({
      finishedSkuId: payload.finishedSkuId,
      finishedSkuCode: payload.finishedSkuCode,
      finishedSkuSnapshotName: payload.finishedSkuSnapshotName,
      quantity: Number(payload.quantity),
      note: payload.note?.trim() || null,
      lines: (payload.lines ?? []).map((l) => ({
        materialSkuId: l.materialSkuId,
        materialSkuCode: l.materialSkuCode,
        materialSnapshotName: l.materialSnapshotName,
        plannedQuantity: Number(l.plannedQuantity),
      })),
    }),
  })
  return mapProductionOrder(data)
}

export async function completeProductionOrder(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/production-orders/${id}/complete`, { method: 'POST' })
  return mapProductionOrder(data)
}

export async function cancelProductionOrder(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/production-orders/${id}/cancel`, { method: 'POST' })
  return mapProductionOrder(data)
}
