import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapImportSlipLine(row) {
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    productSnapshotName: row.productSnapshotName ?? row.ProductSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    warehouseQtyBefore: Number(row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? 0),
    warehouseQtyAfter: Number(row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? 0),
    storeQtyBefore: Number(row.storeQtyBefore ?? row.StoreQtyBefore ?? 0),
    storeQtyAfter: Number(row.storeQtyAfter ?? row.StoreQtyAfter ?? 0),
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
    productionOrderOutputLineId: row.productionOrderOutputLineId ?? row.ProductionOrderOutputLineId ?? null,
    note: row.note ?? row.Note ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
  }
}

function mapImportSlip(row) {
  const lines = (row.lines ?? row.Lines ?? []).map(mapImportSlipLine)
  return {
    id: row.id ?? row.Id,
    importCode: row.importCode ?? row.ImportCode ?? '',
    importType: row.importType ?? row.ImportType ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    productSnapshotName: row.productSnapshotName ?? row.ProductSnapshotName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    warehouseQtyBefore: Number(row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? 0),
    warehouseQtyAfter: Number(row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? 0),
    storeQtyBefore: Number(row.storeQtyBefore ?? row.StoreQtyBefore ?? 0),
    storeQtyAfter: Number(row.storeQtyAfter ?? row.StoreQtyAfter ?? 0),
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
    productionOrderId: row.productionOrderId ?? row.ProductionOrderId ?? null,
    productionCode: row.productionCode ?? row.ProductionCode ?? '',
    note: row.note ?? row.Note ?? '',
    createdBy: row.createdBy ?? row.CreatedBy,
    createdById: row.createdById ?? row.CreatedById ?? null,
    createdByName: row.createdByName ?? row.CreatedByName ?? '',
    createdByRoleName: row.createdByRoleName ?? row.CreatedByRoleName ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    lines,
  }
}

export function getImportTypeLabel(type) {
  if (type === 'production_finished_goods_receipt') return 'Nhập thành phẩm sau sản xuất'
  return type || '—'
}

export async function fetchStockImportSlips({ search } = {}) {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  const query = params.toString()
  const path = `/api/v1/inventory/stock-import-slips${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapImportSlip)
}

export async function fetchStockImportSlipById(id) {
  const data = await apiRequestAuth(`/api/v1/inventory/stock-import-slips/${id}`, { method: 'GET' })
  return mapImportSlip(data)
}
