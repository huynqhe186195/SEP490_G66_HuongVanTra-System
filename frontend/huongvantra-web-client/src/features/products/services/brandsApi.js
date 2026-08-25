import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapBrand(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    name: item.name ?? item.Name ?? '',
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    isDeleted: Boolean(item.isDeleted ?? item.IsDeleted ?? false),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    updatedAt: item.updatedAt ?? item.UpdatedAt ?? null,
  }
}

export async function fetchBrands({ isDeleted } = {}) {
  const params = new URLSearchParams()
  if (isDeleted === true) params.set('isDeleted', 'true')
  if (isDeleted === false) params.set('isDeleted', 'false')
  const query = params.toString()
  const data = await apiRequestAuth(`/api/v1/brands${query ? `?${query}` : ''}`, { method: 'GET' })
  const items = Array.isArray(data) ? data : (data?.items ?? data?.Items ?? [])
  return items.map(mapBrand).filter(Boolean)
}

export async function fetchBrandById(id) {
  const data = await apiRequestAuth(`/api/v1/brands/${id}`, { method: 'GET' })
  return mapBrand(data)
}

export async function createBrand(name) {
  const data = await apiRequestAuth('/api/v1/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name?.trim() }),
  })
  return mapBrand(data)
}

export async function updateBrand(id, payload) {
  const body = { name: payload.name?.trim() }
  if (payload.isActive === true || payload.isActive === false) {
    body.isActive = payload.isActive
  }

  const data = await apiRequestAuth(`/api/v1/brands/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return mapBrand(data)
}

export async function deleteBrand(id) {
  return apiRequestAuth(`/api/v1/brands/${id}`, { method: 'DELETE' })
}

export async function restoreBrand(id) {
  const data = await apiRequestAuth(`/api/v1/brands/${id}/restore`, { method: 'POST' })
  return mapBrand(data)
}
