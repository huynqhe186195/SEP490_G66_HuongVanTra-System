import { apiRequestAuth } from '../../../lib/apiClient.js'

export function fetchPermissions(params = {}) {
  const query = params.onlyDeleted ? '?onlyDeleted=true' : ''
  return apiRequestAuth(`/api/permissions${query}`, { method: 'GET' })
}

export function createPermission(permissionName) {
  return apiRequestAuth('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({ permissionName }),
  })
}

export function softDeletePermission(id) {
  return apiRequestAuth(`/api/permissions/${id}`, { method: 'DELETE' })
}

export function restorePermission(id) {
  return apiRequestAuth(`/api/permissions/${id}/restore`, { method: 'PUT' })
}

export function mapPermission(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    permissionName: item.permissionName ?? item.PermissionName ?? '',
    isDeleted: item.isDeleted ?? item.IsDeleted ?? false,
  }
}
