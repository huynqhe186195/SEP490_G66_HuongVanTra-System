import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapProduct } from './productsApi.js'
import { PRODUCT_TYPE } from '../utils/productTypes.js'

export async function searchMaterials(search = '', pageSize = 20) {
  const productTypes = [PRODUCT_TYPE.NGUYEN_LIEU, PRODUCT_TYPE.BAO_BI, PRODUCT_TYPE.THANH_PHAM]
  const results = await Promise.all(productTypes.map(async (productType) => {
    const params = new URLSearchParams({ pageSize: String(pageSize), isActive: 'true', productType })
    if (search.trim()) params.set('search', search.trim())
    const data = await apiRequestAuth(`/api/v1/products?${params}`, { method: 'GET' })
    return toPagedResult(data).items.map(mapProduct).filter(Boolean)
  }))
  return Array.from(new Map(results.flat().map((item) => [item.id, item])).values())
}

export function mapBomLine(row) {
  if (!row) return null
  const materialUnitName =
    row.materialUnitName ?? row.MaterialUnitName ?? row.materialUnit ?? row.MaterialUnit ?? row.baseUnit ?? row.BaseUnit ?? ''
  return {
    materialId: row.materialId ?? row.MaterialId,
    material_id: row.materialId ?? row.MaterialId,
    materialName: row.materialName ?? row.MaterialName ?? '',
    materialUnitName,
    baseUnit: materialUnitName,
    quantity: Number(row.quantity ?? row.Quantity ?? 0),
    componentVariantId: row.componentVariantId ?? row.ComponentVariantId ?? null,
    componentSkuCode: row.componentSkuCode ?? row.ComponentSkuCode ?? '',
    componentVariantName: row.componentVariantName ?? row.ComponentVariantName ?? '',
    isRequiredBaseComponent: Boolean(row.isRequiredBaseComponent ?? row.IsRequiredBaseComponent ?? false),
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
        materialId: line.materialId ?? line.material_id ?? '00000000-0000-0000-0000-000000000000',
        quantity: Number(line.quantity),
        componentVariantId: line.componentVariantId ?? null,
        componentSkuCode: line.componentSkuCode || null,
        componentRequestSkuKey: line.componentRequestSkuKey || null,
        isRequiredBaseComponent: Boolean(line.isRequiredBaseComponent),
      })),
    }),
  })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapBomLine).filter(Boolean)
}
