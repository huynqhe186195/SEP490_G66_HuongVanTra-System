import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapReceiptItem(row) {
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuNameSnapshot: row.skuNameSnapshot ?? row.SkuNameSnapshot ?? '',
    productTypeSnapshot: row.productTypeSnapshot ?? row.ProductTypeSnapshot ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    submittedUnit: row.submittedUnit ?? row.SubmittedUnit ?? '',
    submittedQuantity: Number(row.submittedQuantity ?? row.SubmittedQuantity ?? 0),
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    unitCost: row.unitCost ?? row.UnitCost ?? null,
    lotCode: row.lotCode ?? row.LotCode ?? '',
    manufacturedAt: row.manufacturedAt ?? row.ManufacturedAt ?? null,
    expiresAt: row.expiresAt ?? row.ExpiresAt ?? null,
    actualReceivedQuantity: Number(row.actualReceivedQuantity ?? row.ActualReceivedQuantity ?? 0),
    qualityNote: row.qualityNote ?? row.QualityNote ?? '',
    warehouseBatchId: row.warehouseBatchId ?? row.WarehouseBatchId ?? null,
    warehouseBatchLotCode: row.warehouseBatchLotCode ?? row.WarehouseBatchLotCode ?? '',
    warehouseQtyBefore: row.warehouseQtyBefore ?? row.WarehouseQtyBefore ?? null,
    warehouseQtyAfter: row.warehouseQtyAfter ?? row.WarehouseQtyAfter ?? null,
    shelfQtyBefore: row.shelfQtyBefore ?? row.ShelfQtyBefore ?? null,
    shelfQtyAfter: row.shelfQtyAfter ?? row.ShelfQtyAfter ?? null,
  }
}

export function mapSupplierReceipt(row) {
  if (!row || typeof row !== 'object') return null
  const items = (row.items ?? row.Items ?? []).map(mapReceiptItem)
  return {
    id: row.id ?? row.Id,
    receiptCode: row.receiptCode ?? row.ReceiptCode ?? '',
    supplierName: row.supplierName ?? row.SupplierName ?? '',
    supplierReference: row.supplierReference ?? row.SupplierReference ?? '',
    supplierDocumentNumber: row.supplierDocumentNumber ?? row.SupplierDocumentNumber ?? '',
    supplierDocumentDate: row.supplierDocumentDate ?? row.SupplierDocumentDate ?? null,
    receivedDate: row.receivedDate ?? row.ReceivedDate ?? null,
    note: row.note ?? row.Note ?? '',
    status: row.status ?? row.Status ?? '',
    createdBy: row.createdBy ?? row.CreatedBy,
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
    stockImportSlipId: row.stockImportSlipId ?? row.StockImportSlipId ?? null,
    stockImportSlipCode: row.stockImportSlipCode ?? row.StockImportSlipCode ?? '',
    totalQuantity: Number(row.totalQuantity ?? row.TotalQuantity ?? items.reduce((sum, item) => sum + item.quantity, 0)),
    items,
  }
}

function buildReceiptPayload(payload) {
  return {
    supplierName: payload.supplierName?.trim() || null,
    supplierReference: payload.supplierReference?.trim() || null,
    supplierDocumentNumber: payload.supplierDocumentNumber?.trim() || null,
    supplierDocumentDate: payload.supplierDocumentDate || null,
    receivedDate: payload.receivedDate || null,
    note: payload.note?.trim() || null,
    items: (payload.items || []).map((line) => ({
      skuId: line.skuId,
      skuCode: line.skuCode || null,
      skuNameSnapshot: line.skuNameSnapshot || null,
      productTypeSnapshot: line.productTypeSnapshot || null,
      inventoryUnitSnapshot: line.inventoryUnitSnapshot || null,
      submittedUnit: line.submittedUnit || null,
      submittedQuantity: Number(line.submittedQuantity),
      unitCost: line.unitCost != null && line.unitCost !== '' ? Number(line.unitCost) : null,
      lotCode: line.lotCode?.trim(),
      manufacturedAt: line.manufacturedAt || null,
      expiresAt: line.expiresAt || null,
      qualityNote: line.qualityNote?.trim() || null,
    })),
  }
}

export async function fetchSupplierReceipts({ status, mine, search, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (mine) params.set('mine', 'true')
  if (search?.trim()) params.set('search', search.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await apiRequestAuth(`/api/v1/inventory/supplier-receipts?${params.toString()}`, { method: 'GET' })
  return {
    items: (data.items ?? data.Items ?? []).map(mapSupplierReceipt).filter(Boolean),
    page: Number(data.page ?? data.Page ?? page),
    pageSize: Number(data.pageSize ?? data.PageSize ?? pageSize),
    totalItems: Number(data.totalItems ?? data.TotalItems ?? 0),
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1),
  }
}

export async function createSupplierReceipt(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/supplier-receipts', {
    method: 'POST',
    body: JSON.stringify(buildReceiptPayload(payload)),
  })
  return mapSupplierReceipt(data)
}

export async function submitSupplierReceipt(id) {
  return mapSupplierReceipt(await apiRequestAuth(`/api/v1/inventory/supplier-receipts/${id}/submit`, { method: 'POST' }))
}

export async function approveSupplierReceipt(id) {
  return mapSupplierReceipt(await apiRequestAuth(`/api/v1/inventory/supplier-receipts/${id}/approve`, { method: 'POST' }))
}

export async function rejectSupplierReceipt(id, reason) {
  return mapSupplierReceipt(await apiRequestAuth(`/api/v1/inventory/supplier-receipts/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }))
}

export async function cancelSupplierReceipt(id, reason) {
  return mapSupplierReceipt(await apiRequestAuth(`/api/v1/inventory/supplier-receipts/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }))
}

export function getSupplierReceiptTemplateUrl() {
  return '/api/v1/inventory/supplier-receipts/template'
}
