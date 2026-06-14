import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { mapProduct } from './productsApi.js'

export async function searchMaterials(search = '', pageSize = 20) {
  const params = new URLSearchParams({ pageSize: String(pageSize), isActive: 'true', productType: 'NGUYEN_LIEU' })
  if (search.trim()) params.set('search', search.trim())
  const data = await apiRequestAuth(`/api/v1/products?${params}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return paged.items.map(mapProduct).filter(Boolean)
}
