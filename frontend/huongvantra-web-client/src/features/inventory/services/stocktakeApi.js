import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapStocktakeLine(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    productTypeSnapshot: row.productTypeSnapshot ?? row.ProductTypeSnapshot ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    systemQuantitySnapshot: Number(row.systemQuantitySnapshot ?? row.SystemQuantitySnapshot ?? 0),
    actualQuantity: Number(row.actualQuantity ?? row.ActualQuantity ?? 0),
    variance: Number(row.variance ?? row.Variance ?? 0),
    reasonCode: row.reasonCode ?? row.ReasonCode ?? '',
    note: row.note ?? row.Note ?? '',
    warehouseQtyBefore: row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? null,
    warehouseQtyAfter: row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? null,
    shelfQtyBefore: row.shelfQtyBefore ?? row.ShelfQtyBefore ?? null,
    shelfQtyAfter: row.shelfQtyAfter ?? row.ShelfQtyAfter ?? null,
    stockExportSlipId: row.stockExportSlipId ?? row.StockExportSlipId ?? null,
    stockExportSlipCode: row.stockExportSlipCode ?? row.StockExportSlipCode ?? '',
    stockImportSlipId: row.stockImportSlipId ?? row.StockImportSlipId ?? null,
    stockImportSlipCode: row.stockImportSlipCode ?? row.StockImportSlipCode ?? '',
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
  }
}

export function mapStocktakeRequest(row) {
  if (!row || typeof row !== 'object') return null
  const items = (row.items ?? row.Items ?? []).map(mapStocktakeLine).filter(Boolean)
  return {
    id: row.id ?? row.Id,
    requestCode: row.requestCode ?? row.RequestCode ?? '',
    location: row.location ?? row.Location ?? 'Warehouse',
    countDate: row.countDate ?? row.CountDate ?? null,
    reason: row.reason ?? row.Reason ?? '',
    note: row.note ?? row.Note ?? '',
    status: row.status ?? row.Status ?? '',
    createdBy: row.createdBy ?? row.CreatedBy ?? null,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    createdByRoleName: row.createdByRoleName ?? row.CreatedByRoleName ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
    submittedBy: row.submittedBy ?? row.SubmittedBy ?? null,
    submittedAt: row.submittedAt ?? row.SubmittedAt ?? null,
    reviewedBy: row.reviewedBy ?? row.ReviewedBy ?? null,
    reviewedByName: row.reviewedByName ?? row.ReviewedByName ?? '',
    reviewedByRoleName: row.reviewedByRoleName ?? row.ReviewedByRoleName ?? '',
    reviewedAt: row.reviewedAt ?? row.ReviewedAt ?? null,
    reviewNote: row.reviewNote ?? row.ReviewNote ?? '',
    totalPositiveVariance: Number(row.totalPositiveVariance ?? row.TotalPositiveVariance ?? 0),
    totalNegativeVariance: Number(row.totalNegativeVariance ?? row.TotalNegativeVariance ?? 0),
    totalAbsoluteVariance: Number(row.totalAbsoluteVariance ?? row.TotalAbsoluteVariance ?? 0),
    items,
  }
}

export async function fetchStocktakeRequests(params = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.location) query.set('location', params.location)
  if (params.mine) query.set('mine', 'true')
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 10))
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests?${query.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapStocktakeRequest).filter(Boolean),
  }
}

export async function fetchStocktakeRequestById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}`, { method: 'GET' })
  return mapStocktakeRequest(data)
}

export async function createStocktakeRequest(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/stocktake-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapStocktakeRequest(data)
}

export async function submitStocktakeRequest(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/submit`, { method: 'POST' })
  return mapStocktakeRequest(data)
}

export async function approveStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}

export async function rejectStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}

export async function cancelStocktakeRequest(id, reason) {
  const data = await apiRequestAuth(`/api/v1/inventory/stocktake-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || null }),
  })
  return mapStocktakeRequest(data)
}
