import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapReturnItem(row) {
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    shelfBatchId: row.shelfBatchId ?? row.ShelfBatchId ?? null,
    shelfLotCode: row.shelfLotCode ?? row.ShelfLotCode ?? '',
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
    shelfQtyBefore: row.shelfQtyBefore ?? row.ShelfQtyBefore ?? null,
    shelfQtyAfter: row.shelfQtyAfter ?? row.ShelfQtyAfter ?? null,
    warehouseQtyBefore: row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? null,
    warehouseQtyAfter: row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? null,
    stockExportSlipId: row.stockExportSlipId ?? row.StockExportSlipId ?? null,
    stockExportSlipCode: row.stockExportSlipCode ?? row.StockExportSlipCode ?? '',
    stockImportSlipId: row.stockImportSlipId ?? row.StockImportSlipId ?? null,
    stockImportSlipCode: row.stockImportSlipCode ?? row.StockImportSlipCode ?? '',
    note: row.note ?? row.Note ?? '',
  }
}

export function mapSupplierReturnRequest(row) {
  const items = (row.items ?? row.Items ?? []).map(mapReturnItem)
  return {
    id: row.id ?? row.Id,
    flow: 'supplier',
    returnCode: row.returnCode ?? row.ReturnCode ?? '',
    supplierReceiptId: row.supplierReceiptId ?? row.SupplierReceiptId ?? null,
    supplierReceiptCode: row.supplierReceiptCode ?? row.SupplierReceiptCode ?? '',
    supplierName: row.supplierName ?? row.SupplierName ?? '',
    supplierReference: row.supplierReference ?? row.SupplierReference ?? '',
    defectReasonCode: row.defectReasonCode ?? row.DefectReasonCode ?? '',
    defectReasonLabel: row.defectReasonLabel ?? row.DefectReasonLabel ?? '',
    evidenceImageUrls: (row.evidenceImageUrls ?? row.EvidenceImageUrls ?? []).filter(Boolean),
    reason: row.reason ?? row.Reason ?? '',
    note: row.note ?? row.Note ?? '',
    status: String(row.status ?? row.Status ?? '').toLowerCase(),
    createdBy: row.createdBy ?? row.CreatedBy,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    createdByRoleName: row.createdByRoleName ?? row.CreatedByRoleName ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  }
}

function buildQuery({ status, mine, search, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (mine) params.set('mine', 'true')
  if (search?.trim()) params.set('search', search.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function mapPaged(data, mapper) {
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapper),
  }
}

export function getInventoryReturnStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'completed') return 'Hoàn tất'
  return status || '—'
}

export function getInventoryReturnStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'completed') return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-700'
}

export async function fetchSupplierReturnRequests(params = {}) {
  const data = await apiRequestAuth(`/api/v1/inventory/supplier-return-requests${buildQuery(params)}`, { method: 'GET' })
  return mapPaged(data, mapSupplierReturnRequest)
}

export async function fetchSupplierReturnDefectReasons() {
  const data = await apiRequestAuth('/api/v1/inventory/supplier-return-requests/defect-reasons', { method: 'GET' })
  return (Array.isArray(data) ? data : []).map((row) => ({
    code: row.code ?? row.Code ?? '',
    label: row.label ?? row.Label ?? '',
  }))
}

export async function createSupplierReturnRequest(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/supplier-return-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapSupplierReturnRequest(data)
}
