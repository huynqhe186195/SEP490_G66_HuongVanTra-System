import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapAllocation(row) {
  return {
    id: row.id ?? row.Id,
    stockTransferLineId: row.stockTransferLineId ?? row.StockTransferLineId,
    sourceWarehouseBatchId: row.sourceWarehouseBatchId ?? row.SourceWarehouseBatchId,
    sourceWarehouseBatchItemId: row.sourceWarehouseBatchItemId ?? row.SourceWarehouseBatchItemId,
    destinationWarehouseBatchId: row.destinationWarehouseBatchId ?? row.DestinationWarehouseBatchId,
    destinationWarehouseBatchItemId: row.destinationWarehouseBatchItemId ?? row.DestinationWarehouseBatchItemId,
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
  }
}

function mapLine(row) {
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuNameSnapshot: row.skuNameSnapshot ?? row.SkuNameSnapshot ?? row.skuName ?? row.SkuName ?? '',
    unitNameSnapshot: row.unitNameSnapshot ?? row.UnitNameSnapshot ?? row.unitName ?? row.UnitName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    sourceRequestLineId: row.sourceRequestLineId ?? row.SourceRequestLineId ?? null,
    batchAllocations: (row.batchAllocations ?? row.BatchAllocations ?? []).map(mapAllocation),
  }
}

export function mapStockTransfer(row) {
  const lines = (row.lines ?? row.Lines ?? []).map(mapLine)
  return {
    id: row.id ?? row.Id ?? row.transferId ?? row.TransferId,
    transferCode: row.transferCode ?? row.TransferCode ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    sourceLocation: row.sourceLocation ?? row.SourceLocation ?? 'Warehouse',
    destinationLocation: row.destinationLocation ?? row.DestinationLocation ?? 'Shelf',
    note: row.note ?? row.Note ?? '',
    createdBy: row.createdBy ?? row.CreatedBy,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    createdByRoleName: row.createdByRoleName ?? row.CreatedByRoleName ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
    completedBy: row.completedBy ?? row.CompletedBy ?? null,
    completedByName: row.completedByName ?? row.CompletedByName ?? '',
    completedByRoleName: row.completedByRoleName ?? row.CompletedByRoleName ?? '',
    completedAt: row.completedAt ?? row.CompletedAt ?? null,
    cancelledBy: row.cancelledBy ?? row.CancelledBy ?? null,
    cancelledAt: row.cancelledAt ?? row.CancelledAt ?? null,
    cancellationReason: row.cancellationReason ?? row.CancellationReason ?? '',
    exportSlipId: row.exportSlipId ?? row.ExportSlipId ?? null,
    exportSlipCode: row.exportSlipCode ?? row.ExportSlipCode ?? '',
    importSlipId: row.importSlipId ?? row.ImportSlipId ?? null,
    importSlipCode: row.importSlipCode ?? row.ImportSlipCode ?? '',
    itemCount: Number(row.itemCount ?? row.ItemCount ?? row.lineCount ?? row.LineCount ?? lines.length),
    sourceRequestId: row.sourceRequestId ?? row.SourceRequestId ?? null,
    sourceRequestCode: row.sourceRequestCode ?? row.SourceRequestCode ?? '',
    sourceRequestedByName: row.sourceRequestedByName ?? row.SourceRequestedByName ?? '',
    sourceSuggestionId: row.sourceSuggestionId ?? row.SourceSuggestionId ?? null,
    sourceSuggestionCode: row.sourceSuggestionCode ?? row.SourceSuggestionCode ?? '',
    sourceOrderId: row.sourceOrderId ?? row.SourceOrderId ?? null,
    sourceOrderCode: row.sourceOrderCode ?? row.SourceOrderCode ?? '',
    sourceOrderChannel: row.sourceOrderChannel ?? row.SourceOrderChannel ?? '',
    totalQuantity: Number(
      row.totalQuantity
      ?? row.TotalQuantity
      ?? lines.reduce((sum, line) => sum + line.quantity, 0),
    ),
    lines,
  }
}

function buildBody(payload) {
  return {
    note: String(payload.note ?? '').trim() || null,
    sourceRequestId: payload.sourceRequestId || null,
    sourceSuggestionId: payload.sourceSuggestionId || null,
    lines: (payload.lines ?? []).map((line) => ({
      skuId: line.skuId,
      skuCode: String(line.skuCode ?? '').trim() || null,
      quantity: Number(line.quantity),
      sourceRequestLineId: line.sourceRequestLineId || null,
    })),
  }
}

export async function fetchStockTransfers({
  status,
  search,
  page = 1,
  pageSize = 10,
  sourceRequestId,
  transferType,
  createdBy,
  fromDate,
  toDate,
  sort,
} = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search?.trim()) params.set('search', search.trim())
  if (sourceRequestId) params.set('sourceRequestId', sourceRequestId)
  if (transferType) params.set('transferType', transferType)
  if (createdBy) params.set('createdBy', createdBy)
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)
  if (sort?.trim()) params.set('sort', sort.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await apiRequestAuth(`/api/v1/inventory/stock-transfers?${params.toString()}`, {
    method: 'GET',
  })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapStockTransfer),
  }
}

export async function fetchStockTransferById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-transfers/${id}`, { method: 'GET' })
  return mapStockTransfer(data)
}

export async function createStockTransfer(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/stock-transfers', {
    method: 'POST',
    body: JSON.stringify(buildBody(payload)),
  })
  return mapStockTransfer(data)
}

export async function updateStockTransfer(id, payload) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-transfers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildBody(payload)),
  })
  return mapStockTransfer(data)
}

export async function completeStockTransfer(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-transfers/${id}/complete`, {
    method: 'POST',
  })
  return mapStockTransfer(data)
}

export async function cancelStockTransfer(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-transfers/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: String(reason ?? '').trim() }),
  })
  return mapStockTransfer(data)
}
