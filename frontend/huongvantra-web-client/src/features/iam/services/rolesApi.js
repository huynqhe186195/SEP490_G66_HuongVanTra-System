import { apiRequestAuth } from '../../../lib/apiClient.js'

export function fetchRoles(params = {}) {
  const query = params.onlyDeleted ? '?onlyDeleted=true' : ''
  return apiRequestAuth(`/api/roles${query}`, { method: 'GET' })
}

export function fetchRoleById(id) {
  return apiRequestAuth(`/api/roles/${id}`, { method: 'GET' })
}

export function createRole(payload) {
  return apiRequestAuth('/api/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateRole(id, payload) {
  return apiRequestAuth(`/api/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function softDeleteRole(id) {
  return apiRequestAuth(`/api/roles/${id}`, { method: 'DELETE' })
}

export function restoreRole(id) {
  return apiRequestAuth(`/api/roles/${id}/restore`, { method: 'PUT' })
}

/** @deprecated Dùng softDeleteRole */
export const deleteRole = softDeleteRole

export function assignRolePermissions(roleId, permissionIds) {
  return apiRequestAuth(`/api/roles/${roleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissionIds }),
  })
}

export function revokeRolePermission(roleId, permissionId) {
  return apiRequestAuth(`/api/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })
}

export function fetchRolePermissions(roleId) {
  return apiRequestAuth(`/api/roles/${roleId}/permissions`, { method: 'GET' })
}

export function mapRole(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    roleName: item.roleName ?? item.RoleName ?? '',
    description: item.description ?? item.Description ?? '',
    permissions: item.permissions ?? item.Permissions ?? [],
    isDeleted: item.isDeleted ?? item.IsDeleted ?? false,
  }
}
