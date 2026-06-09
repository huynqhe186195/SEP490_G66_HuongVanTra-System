import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapExportSlip(row) {
  return {
    id: row.id ?? row.Id,
    exportCode: row.exportCode ?? row.ExportCode ?? '',
    exportType: row.exportType ?? row.ExportType ?? '',
    stockAdjustmentRequestId: row.stockAdjustmentRequestId ?? row.StockAdjustmentRequestId ?? null,
    stockAdjustmentRequestCode: row.stockAdjustmentRequestCode ?? row.StockAdjustmentRequestCode ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    warehouseQtyBefore: Number(row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? 0),
    warehouseQtyAfter: Number(row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? 0),
    storeQtyBefore: Number(row.storeQtyBefore ?? row.StoreQtyBefore ?? 0),
    storeQtyAfter: Number(row.storeQtyAfter ?? row.StoreQtyAfter ?? 0),
    note: row.note ?? row.Note ?? '',
    createdBy: row.createdBy ?? row.CreatedBy,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
  }
}

export function getExportTypeLabel(type) {
  if (type === 'transfer_to_store') return 'Xuất sang cửa hàng'
  if (type === 'simulated_transfer') return 'Xuất giả lập (CH)'
  return type || '—'
}

export async function fetchStockExportSlips({ search } = {}) {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  const query = params.toString()
  const path = `/api/v1/inventory/stock-export-slips${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapExportSlip)
}

export async function fetchStockExportSlipById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-export-slips/${id}`, { method: 'GET' })
  return mapExportSlip(data)
}
