import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapPendingSync(data) {
  if (!data || typeof data !== 'object') {
    return { categories: 0, products: 0, skus: 0, total: 0 }
  }
  const categories = Number(data.categories ?? data.Categories ?? 0)
  const products = Number(data.products ?? data.Products ?? 0)
  const skus = Number(data.skus ?? data.Skus ?? 0)
  const total = Number(data.total ?? data.Total ?? categories + products + skus)
  return { categories, products, skus, total }
}

export function mapSyncResult(data) {
  if (!data || typeof data !== 'object') {
    return { categoriesSynced: 0, productsSynced: 0, skusSynced: 0, syncedAt: null }
  }
  return {
    categoriesSynced: Number(data.categoriesSynced ?? data.CategoriesSynced ?? 0),
    productsSynced: Number(data.productsSynced ?? data.ProductsSynced ?? 0),
    skusSynced: Number(data.skusSynced ?? data.SkusSynced ?? 0),
    syncedAt: data.syncedAt ?? data.SyncedAt ?? null,
  }
}

export async function fetchPendingCatalogSync() {
  const data = await apiRequestAuth('/api/v1/catalog/sync/pending', { method: 'GET' })
  return mapPendingSync(data)
}

export async function syncCatalogToStore() {
  const data = await apiRequestAuth('/api/v1/catalog/sync', { method: 'POST' })
  return mapSyncResult(data)
}
