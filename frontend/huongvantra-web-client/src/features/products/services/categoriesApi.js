import { apiRequestAuth } from '../../../lib/apiClient.js'

export function mapCategory(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    name: item.name ?? item.Name ?? '',
    description: item.description ?? item.Description ?? '',
    parentId: item.parentId ?? item.ParentId ?? null,
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    isDeleted: Boolean(item.isDeleted ?? item.IsDeleted ?? false),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    syncedToStoreAt: item.syncedToStoreAt ?? item.SyncedToStoreAt ?? null,
  }
}

export async function fetchCategories({ isDeleted } = {}) {
  const params = new URLSearchParams()
  if (isDeleted === true) params.set('isDeleted', 'true')
  const query = params.toString()
  const data = await apiRequestAuth(`/api/v1/categories${query ? `?${query}` : ''}`, { method: 'GET' })
  const items = Array.isArray(data) ? data : data?.items ?? data?.Items ?? []
  return items.map(mapCategory).filter(Boolean)
}

export async function fetchCategoryById(id) {
  const data = await apiRequestAuth(`/api/v1/categories/${id}`, { method: 'GET' })
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
  const body = {
    name: payload.name?.trim(),
    description: payload.description?.trim() || null,
    parentId: payload.parentId ?? null,
  }
  if (payload.isActive === true || payload.isActive === false) {
    body.isActive = payload.isActive
  }

  const data = await apiRequestAuth(`/api/v1/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return mapCategory(data)
}

export async function setCategoryStatus(category, isActive) {
  return updateCategory(category.id, {
    name: category.name,
    description: category.description || '',
    parentId: category.parentId ?? null,
    isActive,
  })
}

export async function deleteCategory(id) {
  return apiRequestAuth(`/api/v1/categories/${id}`, { method: 'DELETE' })
}

export async function restoreCategory(id) {
  const data = await apiRequestAuth(`/api/v1/categories/${id}/restore`, { method: 'POST' })
  return mapCategory(data)
}
