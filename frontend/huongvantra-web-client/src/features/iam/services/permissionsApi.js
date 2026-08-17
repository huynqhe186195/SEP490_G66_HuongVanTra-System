import { apiRequestAuth } from '../../../lib/apiClient.js'

export function fetchPermissions(params = {}) {
  const query = params.onlyDeleted ? '?onlyDeleted=true' : ''
  return apiRequestAuth(`/api/permissions${query}`, { method: 'GET' })
}

export function createPermission({ permissionName, permissionCode }) {
  return apiRequestAuth('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({ permissionName, permissionCode }),
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
  const permissionName = item.permissionName ?? item.PermissionName ?? ''
  const permissionCode = item.permissionCode ?? item.PermissionCode ?? permissionName
  return {
    id: item.id ?? item.Id,
    permissionName,
    permissionCode,
    isDeleted: item.isDeleted ?? item.IsDeleted ?? false,
  }
}
