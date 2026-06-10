import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapWarehouseBatchItem(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    productSnapshotName: row.productSnapshotName ?? row.ProductSnapshotName ?? '',
    quantityOnHand: Number(row.quantityOnHand ?? row.QuantityOnHand ?? 0),
    initialQuantity: Number(row.initialQuantity ?? row.InitialQuantity ?? 0),
    unitCost: row.unitCost ?? row.UnitCost ?? null,
  }
}

export function mapWarehouseBatch(row) {
  if (!row || typeof row !== 'object') return null
  const items = (row.items ?? row.Items ?? []).map(mapWarehouseBatchItem).filter(Boolean)
  return {
    id: row.id ?? row.Id,
    lotCode: row.lotCode ?? row.LotCode ?? '',
    supplier: row.supplier ?? row.Supplier ?? '',
    expiresAt: row.expiresAt ?? row.ExpiresAt ?? null,
    note: row.note ?? row.Note ?? '',
    status: row.status ?? row.Status ?? 'active',
    totalQuantityOnHand: Number(row.totalQuantityOnHand ?? row.TotalQuantityOnHand ?? items.reduce((s, i) => s + i.quantityOnHand, 0)),
    skuLineCount: Number(row.skuLineCount ?? row.SkuLineCount ?? items.length),
    createdBy: row.createdBy ?? row.CreatedBy,
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
    items,
  }
}

export async function fetchWarehouseBatches({ skuId, search, availableOnly } = {}) {
  const params = new URLSearchParams()
  if (skuId) params.set('skuId', String(skuId))
  if (search?.trim()) params.set('search', search.trim())
  if (availableOnly) params.set('availableOnly', 'true')
  const query = params.toString()
  const path = `/api/v1/inventory/warehouse-batches${query ? `?${query}` : ''}`
  const data = await apiRequestAuth(path, { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapWarehouseBatch).filter(Boolean)
}

export async function createWarehouseBatch(payload) {
  const data = await apiRequestAuth('/api/v1/inventory/warehouse-batches', {
    method: 'POST',
    body: JSON.stringify({
      lotCode: payload.lotCode?.trim(),
      supplier: payload.supplier?.trim() || null,
      expiresAt: payload.expiresAt || null,
      note: payload.note?.trim() || null,
      items: (payload.items || []).map((line) => ({
        skuId: line.skuId,
        skuCode: line.skuCode || null,
        productSnapshotName: line.productSnapshotName || null,
        quantity: Number(line.quantity),
        unitCost: line.unitCost != null && line.unitCost !== '' ? Number(line.unitCost) : null,
      })),
    }),
  })
  return mapWarehouseBatch(data)
}
