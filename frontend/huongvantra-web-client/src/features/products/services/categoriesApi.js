import { apiRequest, apiRequestAuth } from '../../../lib/apiClient.js'

export function mapCategory(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    name: item.name ?? item.Name ?? '',
    description: item.description ?? item.Description ?? '',
    parentId: item.parentId ?? item.ParentId ?? null,
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export async function fetchCategories() {
  const data = await apiRequest('/api/v1/categories', { method: 'GET' })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapCategory).filter(Boolean)
}

export async function fetchCategoryById(id) {
  const data = await apiRequest(`/api/v1/categories/${id}`, { method: 'GET' })
  return mapCategory(data)
}

export async function createCategory(payload) {
  const data = await apiRequestAuth('/api/v1/categories', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name?.trim(),
      description: payload.description?.trim() || null,
      parentId: payload.parentId ?? null,
    }),
  })
  return mapCategory(data)
}

export async function updateCategory(id, payload) {
  const data = await apiRequestAuth(`/api/v1/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name?.trim(),
      description: payload.description?.trim() || null,
      parentId: payload.parentId ?? null,
    }),
  })
  return mapCategory(data)
}

export async function deleteCategory(id) {
  return apiRequestAuth(`/api/v1/categories/${id}`, { method: 'DELETE' })
}
