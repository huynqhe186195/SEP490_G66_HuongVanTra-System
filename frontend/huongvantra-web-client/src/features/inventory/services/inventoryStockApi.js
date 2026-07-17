import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapSkuStock(row) {
  return {
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    weightInGrams: Number(row.weightInGrams ?? row.WeightInGrams ?? 0),
    quantityOnHand: Number(row.quantityOnHand ?? row.QuantityOnHand ?? 0),
    warehouseQuantityOnHand: Number(row.warehouseQuantityOnHand ?? row.WarehouseQuantityOnHand ?? 0),
    lowStockThreshold: Number(row.lowStockThreshold ?? row.LowStockThreshold ?? 0),
    warehouseLowStockThreshold: Number(row.warehouseLowStockThreshold ?? row.WarehouseLowStockThreshold ?? 0),
    shelfLowStockThreshold: Number(row.shelfLowStockThreshold ?? row.ShelfLowStockThreshold ?? row.lowStockThreshold ?? row.LowStockThreshold ?? 0),
    updatedAt: row.updatedAt ?? row.UpdatedAt ?? null,
  }
}

export async function fetchSkuStocks() {
  const data = await apiRequestAuth('/api/v1/inventory/sku-stocks', { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapSkuStock)
}

export function buildStockBySkuIdMap(stocks = []) {
  return new Map(stocks.map((row) => [row.skuId, row.quantityOnHand]))
}

export function buildWarehouseStockBySkuIdMap(stocks = []) {
  return new Map(stocks.map((row) => [row.skuId, row.warehouseQuantityOnHand]))
}

/** Gộp toàn bộ SKU trong danh mục với dòng tồn (SKU chưa có dòng tồn hiển thị 0). */
export function mergeCatalogSkusWithStocks(skus = [], stocks = [], productNameById = new Map()) {
  const stockBySkuId = new Map(stocks.map((row) => [row.skuId, row]))
  const catalogSkuIds = new Set(skus.map((sku) => sku.id))

  const merged = skus.map((sku) => {
    const stock = stockBySkuId.get(sku.id)
    return {
      skuId: sku.id,
      productId: sku.productId,
      productName: productNameById.get(sku.productId) || '—',
      skuCode: sku.skuCode,
      weightInGrams: stock?.weightInGrams ?? sku.weightInGrams ?? 0,
      quantityOnHand: stock?.quantityOnHand ?? 0,
      warehouseQuantityOnHand: stock?.warehouseQuantityOnHand ?? 0,
      warehouseLowStockThreshold: stock?.warehouseLowStockThreshold ?? 0,
      shelfLowStockThreshold: stock?.shelfLowStockThreshold ?? stock?.lowStockThreshold ?? 0,
      updatedAt: stock?.updatedAt ?? null,
    }
  })

  for (const stock of stocks) {
    if (catalogSkuIds.has(stock.skuId)) continue
    merged.push({
      skuId: stock.skuId,
      productId: null,
      productName: '—',
      skuCode: stock.skuCode,
      weightInGrams: stock.weightInGrams ?? 0,
      quantityOnHand: stock.quantityOnHand ?? 0,
      warehouseQuantityOnHand: stock.warehouseQuantityOnHand ?? 0,
      warehouseLowStockThreshold: stock.warehouseLowStockThreshold ?? 0,
      shelfLowStockThreshold: stock.shelfLowStockThreshold ?? stock.lowStockThreshold ?? 0,
      updatedAt: stock.updatedAt ?? null,
    })
  }

  return merged.sort((a, b) => {
    const productCompare = String(a.productName).localeCompare(String(b.productName), 'vi')
    if (productCompare !== 0) return productCompare
    return String(a.skuCode).localeCompare(String(b.skuCode), 'vi')
  })
}

export async function fetchInventorySettings() {
  try {
    const data = await apiRequestAuth('/api/v1/inventory/settings', { method: 'GET' })
    return {
      simulateWarehouse: Boolean(data?.simulateWarehouse ?? data?.SimulateWarehouse ?? false),
    }
  } catch {
    return { simulateWarehouse: false }
  }
}

export async function fetchLowStockSkus() {
  const data = await apiRequestAuth('/api/v1/inventory/sku-stocks/low-stock', { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map(mapSkuStock)
}

export async function updateLowStockThreshold(skuId, threshold, location = 'Shelf') {
  await apiRequestAuth(`/api/v1/inventory/sku-stocks/${skuId}/threshold`, {
    method: 'PUT',
    body: JSON.stringify({ threshold: Number(threshold), location }),
  })
}
