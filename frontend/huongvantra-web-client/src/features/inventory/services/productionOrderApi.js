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

export function mapProductionOrderOutputLine(row) {
  if (!row) return null
  const plannedQuantity = Number(row.plannedQuantity ?? row.PlannedQuantity ?? row.quantity ?? row.Quantity ?? 0)
  return {
    id: row.id ?? row.Id,
    finishedSkuId: row.finishedSkuId ?? row.FinishedSkuId,
    finishedSkuCode: row.finishedSkuCode ?? row.FinishedSkuCode ?? '',
    finishedSkuSnapshotName: row.finishedSkuSnapshotName ?? row.FinishedSkuSnapshotName ?? '',
    plannedQuantity,
    expiresAt: row.expiresAt ?? row.ExpiresAt ?? null,
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? null,
  }
}

export function mapProductionOrder(row) {
  if (!row) return null
  const outputLines = (row.outputLines ?? row.OutputLines ?? []).map(mapProductionOrderOutputLine).filter(Boolean)
  return {
    id: row.id ?? row.Id,
    productionCode: row.productionCode ?? row.ProductionCode ?? '',
    note: row.note ?? row.Note ?? null,
    status: row.status ?? row.Status ?? 'Draft',
    createdBy: row.createdBy ?? row.CreatedBy,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    completedAt: row.completedAt ?? row.CompletedAt ?? null,
    lines: (row.lines ?? row.Lines ?? []).map(mapProductionOrderLine).filter(Boolean),
    outputLines,
  }
}

export const PRODUCTION_STATUS_LABEL = {
  Draft: 'Chờ xác nhận',
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
  const outputLines = payload.outputLines ?? payload.outputs ?? []
  const data = await apiRequestAuth('/api/v1/inventory/production-orders', {
    method: 'POST',
    body: JSON.stringify({
      note: payload.note?.trim() || null,
      outputLines: outputLines.map((output) => ({
        finishedSkuId: output.finishedSkuId,
        finishedSkuCode: output.finishedSkuCode,
        finishedSkuSnapshotName: output.finishedSkuSnapshotName,
        plannedQuantity: Number(output.plannedQuantity ?? output.quantity),
        expiresAt: output.expiresAt || null,
      })),
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
