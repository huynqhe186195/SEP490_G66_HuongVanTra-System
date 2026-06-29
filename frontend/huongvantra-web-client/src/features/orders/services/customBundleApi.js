import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapCustomBundleIngredient(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    materialSkuId: item.materialSkuId ?? item.MaterialSkuId,
    materialSkuCode: item.materialSkuCode ?? item.MaterialSkuCode ?? '',
    materialSnapshotName: item.materialSnapshotName ?? item.MaterialSnapshotName ?? '',
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
    subTotal: Number(item.subTotal ?? item.SubTotal ?? 0),
  }
}

export function mapCustomBundle(item) {
  if (!item || typeof item !== 'object') return null
  const rawIngredients = item.ingredients ?? item.Ingredients ?? []
  return {
    id: item.id ?? item.Id,
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    customerName: item.customerName ?? item.CustomerName ?? '',
    label: item.label ?? item.Label ?? '',
    note: item.note ?? item.Note ?? '',
    totalPrice: Number(item.totalPrice ?? item.TotalPrice ?? 0),
    packingStatus: item.packingStatus ?? item.PackingStatus ?? 'Pending',
    packedAt: item.packedAt ?? item.PackedAt ?? null,
    ingredients: Array.isArray(rawIngredients)
      ? rawIngredients.map(mapCustomBundleIngredient).filter(Boolean)
      : [],
  }
}

export async function fetchPendingCustomBundles({ page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const data = await apiRequestAuth(`/api/v1/orders/custom-bundles?${query.toString()}`, {
    method: 'GET',
  })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapCustomBundle).filter(Boolean),
  }
}

export async function confirmPacking(bundleId) {
  const data = await apiRequestAuth(`/api/v1/orders/custom-bundles/${encodeURIComponent(bundleId)}/pack`, {
    method: 'PATCH',
  })
  return mapCustomBundle(data)
}
