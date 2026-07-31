import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function mapSuggestionItem(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id ?? row.Id,
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    skuSnapshotName: row.skuSnapshotName ?? row.SkuSnapshotName ?? '',
    inventoryUnitSnapshot: row.inventoryUnitSnapshot ?? row.InventoryUnitSnapshot ?? '',
    shelfQuantityAtStocktake: Number(row.shelfQuantityAtStocktake ?? row.ShelfQuantityAtStocktake ?? 0),
    shelfReservedAtStocktake: Number(row.shelfReservedAtStocktake ?? row.ShelfReservedAtStocktake ?? 0),
    shelfLowStockThreshold: Number(row.shelfLowStockThreshold ?? row.ShelfLowStockThreshold ?? 0),
    warehouseQuantityAtStocktake: Number(row.warehouseQuantityAtStocktake ?? row.WarehouseQuantityAtStocktake ?? 0),
  }
}

export function mapShelfReplenishmentSuggestion(row) {
  if (!row || typeof row !== 'object') return null
  const items = (row.items ?? row.Items ?? []).map(mapSuggestionItem).filter(Boolean)
  return {
    id: row.id ?? row.Id,
    suggestionCode: row.suggestionCode ?? row.SuggestionCode ?? '',
    sourceStocktakeRequestId: row.sourceStocktakeRequestId ?? row.SourceStocktakeRequestId ?? null,
    sourceStocktakeCode: row.sourceStocktakeCode ?? row.SourceStocktakeCode ?? '',
    status: row.status ?? row.Status ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? null,
    handledBy: row.handledBy ?? row.HandledBy ?? null,
    handledByName: row.handledByName ?? row.HandledByName ?? '',
    handledByRoleName: row.handledByRoleName ?? row.HandledByRoleName ?? '',
    handledAt: row.handledAt ?? row.HandledAt ?? null,
    handledNote: row.handledNote ?? row.HandledNote ?? '',
    itemCount: Number(row.itemCount ?? row.ItemCount ?? items.length),
    items,
  }
}

export async function fetchShelfReplenishmentSuggestions(params = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 10))
  const data = await apiRequestAuth(
    `/api/v1/inventory/shelf-replenishment-suggestions?${query.toString()}`,
    { method: 'GET' },
  )
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapShelfReplenishmentSuggestion).filter(Boolean),
  }
}

export async function fetchShelfReplenishmentSuggestionById(id) {
  const data = await apiRequestAuth(
    `/api/v1/inventory/shelf-replenishment-suggestions/${id}`,
    { method: 'GET' },
  )
  return mapShelfReplenishmentSuggestion(data)
}

export async function fetchOpenShelfReplenishmentSuggestionCount() {
  const data = await apiRequestAuth(
    '/api/v1/inventory/shelf-replenishment-suggestions/open-count',
    { method: 'GET' },
  )
  return Number(data?.count ?? data?.Count ?? 0)
}

export async function dismissShelfReplenishmentSuggestion(id, reason) {
  const data = await apiRequestAuth(
    `/api/v1/inventory/shelf-replenishment-suggestions/${id}/dismiss`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: reason?.trim() || null }),
    },
  )
  return mapShelfReplenishmentSuggestion(data)
}

export const SHELF_SUGGESTION_STATUS_LABELS = {
  Open: 'Đang mở',
  Handled: 'Đã xử lý',
  Dismissed: 'Đã bỏ qua',
}
