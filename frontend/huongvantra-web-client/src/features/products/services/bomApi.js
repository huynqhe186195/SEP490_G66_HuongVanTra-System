import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapProduct } from './productsApi.js'

export async function searchMaterials(search = '', pageSize = 20) {
  const params = new URLSearchParams({ pageSize: String(pageSize), isActive: 'true', productType: 'NGUYEN_LIEU' })
  if (search.trim()) params.set('search', search.trim())
  const data = await apiRequestAuth(`/api/v1/products?${params}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return paged.items.map(mapProduct).filter(Boolean)
}

export function mapBomLine(row) {
  if (!row) return null
  return {
    materialId: row.materialId ?? row.MaterialId,
    material_id: row.materialId ?? row.MaterialId,
    materialName: row.materialName ?? row.MaterialName ?? '',
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
  }
}

export async function fetchVariantBom(variantId) {
  const data = await apiRequestAuth(`/api/v1/products/variants/${variantId}/bom`, { method: 'GET' })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapBomLine).filter(Boolean)
}

export async function updateVariantBom(variantId, lines = []) {
  const data = await apiRequestAuth(`/api/v1/products/variants/${variantId}/bom`, {
    method: 'PUT',
    body: JSON.stringify({
      lines: lines.map((line) => ({
        materialId: line.materialId ?? line.material_id,
        quantity: Number(line.quantity),
      })),
    }),
  })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapBomLine).filter(Boolean)
}
