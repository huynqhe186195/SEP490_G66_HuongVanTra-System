import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapSkuStock(row) {
  return {
    skuId: row.skuId ?? row.SkuId,
    skuCode: row.skuCode ?? row.SkuCode ?? '',
    weightInGrams: Number(row.weightInGrams ?? row.WeightInGrams ?? 0),
    quantityOnHand: Number(row.quantityOnHand ?? row.QuantityOnHand ?? 0),
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

export async function adjustSkuStock(skuId, quantityDelta) {
  const data = await apiRequestAuth(`/api/v1/inventory/sku-stocks/${skuId}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ quantityDelta: Number(quantityDelta) }),
  })
  return mapSkuStock(data)
}
