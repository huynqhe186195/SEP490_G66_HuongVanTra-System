import { apiRequestAuth } from '../../../lib/apiClient.js'

const BASE = '/api/v1/inventory/supplier-products'

export function mapSupplierProduct(row) {
  if (!row || typeof row !== 'object') return null
  const quotedPrice = row.quotedPrice ?? row.QuotedPrice
  const minimumOrderQuantity = row.minimumOrderQuantity ?? row.MinimumOrderQuantity
  const leadTimeDays = row.leadTimeDays ?? row.LeadTimeDays
  return {
    id: row.id ?? row.Id,
    supplierId: row.supplierId ?? row.SupplierId,
    supplierCodeSnapshot: row.supplierCodeSnapshot ?? row.SupplierCodeSnapshot ?? '',
    supplierName: row.supplierName ?? row.SupplierName ?? '',
    skuId: row.skuId ?? row.SkuId,
    skuCodeSnapshot: row.skuCodeSnapshot ?? row.SkuCodeSnapshot ?? '',
    skuNameSnapshot: row.skuNameSnapshot ?? row.SkuNameSnapshot ?? '',
    productTypeSnapshot: row.productTypeSnapshot ?? row.ProductTypeSnapshot ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    supplierItemCode: row.supplierItemCode ?? row.SupplierItemCode ?? '',
    supplierItemName: row.supplierItemName ?? row.SupplierItemName ?? '',
    quotedPrice: quotedPrice == null ? null : Number(quotedPrice),
    minimumOrderQuantity: minimumOrderQuantity == null ? null : Number(minimumOrderQuantity),
    leadTimeDays: leadTimeDays == null ? null : Number(leadTimeDays),
    isPrimarySource: row.isPrimarySource ?? row.IsPrimarySource ?? false,
    note: row.note ?? row.Note ?? '',
    isActive: row.isActive ?? row.IsActive ?? true,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
  }
}

export function mapSupplierProductPriceHistory(row) {
  if (!row || typeof row !== 'object') return null
  const oldPrice = row.oldPrice ?? row.OldPrice
  const newPrice = row.newPrice ?? row.NewPrice
  return {
    id: row.id ?? row.Id,
    supplierProductId: row.supplierProductId ?? row.SupplierProductId,
    oldPrice: oldPrice == null ? null : Number(oldPrice),
    newPrice: newPrice == null ? null : Number(newPrice),
    effectiveDate: row.effectiveDate ?? row.EffectiveDate ?? null,
    changedBy: row.changedBy ?? row.ChangedBy ?? null,
    changedByName: row.changedByName ?? row.ChangedByName ?? '',
    changedAt: row.changedAt ?? row.ChangedAt ?? null,
    reason: row.reason ?? row.Reason ?? '',
  }
}

export async function fetchSupplierProducts({
  supplierId,
  search,
  productType,
  includeInactive = false,
  page = 1,
  pageSize = 20,
} = {}) {
  const params = new URLSearchParams()
  if (supplierId) params.set('supplierId', supplierId)
  if (search?.trim()) params.set('search', search.trim())
  if (productType) params.set('productType', productType)
  if (includeInactive) params.set('includeInactive', 'true')
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await apiRequestAuth(`${BASE}?${params.toString()}`, { method: 'GET' })
  return {
    items: (data.items ?? data.Items ?? []).map(mapSupplierProduct).filter(Boolean),
    page: Number(data.page ?? data.Page ?? page),
    pageSize: Number(data.pageSize ?? data.PageSize ?? pageSize),
    totalItems: Number(data.totalItems ?? data.TotalItems ?? 0),
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1),
  }
}

/** Danh mục hàng đang cung ứng — dùng để lọc SKU và điền sẵn giá chào khi lập phiếu nhập. */
export async function fetchActiveSupplierProducts(supplierId) {
  const data = await apiRequestAuth(`${BASE}/by-supplier/${supplierId}/active`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapSupplierProduct).filter(Boolean) : []
}

export async function fetchSupplierProductsBySku(skuId) {
  const data = await apiRequestAuth(`${BASE}/by-sku/${skuId}`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapSupplierProduct).filter(Boolean) : []
}

export async function fetchSupplierProductById(id) {
  const data = await apiRequestAuth(`${BASE}/${id}`, { method: 'GET' })
  return mapSupplierProduct(data)
}

export async function fetchSupplierProductPriceHistory(id) {
  const data = await apiRequestAuth(`${BASE}/${id}/price-history`, { method: 'GET' })
  return Array.isArray(data) ? data.map(mapSupplierProductPriceHistory).filter(Boolean) : []
}

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function createSupplierProduct(supplierId, payload) {
  const data = await apiRequestAuth(`${BASE}/by-supplier/${supplierId}`, {
    method: 'POST',
    body: JSON.stringify({
      skuId: payload.skuId,
      supplierItemCode: payload.supplierItemCode?.trim() || null,
      supplierItemName: payload.supplierItemName?.trim() || null,
      quotedPrice: toOptionalNumber(payload.quotedPrice),
      isPrimarySource: Boolean(payload.isPrimarySource),
      note: payload.note?.trim() || null,
    }),
  })
  return mapSupplierProduct(data)
}

export function mapSupplierProductImportRow(row) {
  if (!row || typeof row !== 'object') return null
  const messages = row.messages ?? row.Messages ?? []
  return {
    rowNumber: Number(row.rowNumber ?? row.RowNumber ?? 0),
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    status: row.status ?? row.Status ?? 'Error',
    messages: Array.isArray(messages) ? messages : [],
  }
}

export function mapSupplierProductImportResult(data) {
  const rows = data?.rows ?? data?.Rows ?? []
  return {
    totalRows: Number(data?.totalRows ?? data?.TotalRows ?? 0),
    successCount: Number(data?.successCount ?? data?.SuccessCount ?? 0),
    failedCount: Number(data?.failedCount ?? data?.FailedCount ?? 0),
    warningCount: Number(data?.warningCount ?? data?.WarningCount ?? 0),
    rows: (Array.isArray(rows) ? rows : []).map(mapSupplierProductImportRow).filter(Boolean),
  }
}

/** Import danh mục hàng cung ứng. Client đã tra sẵn skuId từ mã SKU trong file. */
export async function importSupplierProducts(supplierId, rows) {
  const data = await apiRequestAuth(`${BASE}/by-supplier/${supplierId}/import`, {
    method: 'POST',
    body: JSON.stringify({
      rows: rows.map((row) => ({
        rowNumber: Number(row.rowNumber) || 0,
        skuId: row.skuId || '00000000-0000-0000-0000-000000000000',
        skuCode: row.skuCode?.trim() || null,
        supplierItemCode: row.supplierItemCode?.trim() || null,
        supplierItemName: row.supplierItemName?.trim() || null,
        quotedPrice: toOptionalNumber(row.quotedPrice),
        isPrimarySource: false,
        note: row.note?.trim() || null,
      })),
    }),
  })
  return mapSupplierProductImportResult(data)
}

export async function updateSupplierProduct(id, payload) {
  const data = await apiRequestAuth(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      supplierItemCode: payload.supplierItemCode?.trim() || null,
      supplierItemName: payload.supplierItemName?.trim() || null,
      isPrimarySource: Boolean(payload.isPrimarySource),
      note: payload.note?.trim() || null,
    }),
  })
  return mapSupplierProduct(data)
}

export async function updateSupplierProductPrice(id, payload) {
  const data = await apiRequestAuth(`${BASE}/${id}/price`, {
    method: 'PUT',
    body: JSON.stringify({
      quotedPrice: toOptionalNumber(payload.quotedPrice),
      effectiveDate: payload.effectiveDate || null,
      reason: payload.reason?.trim() || null,
    }),
  })
  return mapSupplierProduct(data)
}

export async function deactivateSupplierProduct(id) {
  const data = await apiRequestAuth(`${BASE}/${id}`, { method: 'DELETE' })
  return mapSupplierProduct(data)
}

export async function restoreSupplierProduct(id) {
  const data = await apiRequestAuth(`${BASE}/${id}/restore`, { method: 'POST' })
  return mapSupplierProduct(data)
}
