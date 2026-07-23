import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function fetchUsers(params = {}) {
  const keyword = params.search?.trim().toLowerCase()
  if (keyword) return fetchUsersWithClientSearch(params, keyword)

  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))
  if (params.onlyDeleted) search.set('onlyDeleted', 'true')
  const query = search.toString()
  const path = query ? `/api/users?${query}` : '/api/users'
  return apiRequestAuth(path, { method: 'GET' }).then(toPagedResult)
}

async function fetchUsersWithClientSearch(params, keyword) {
  const requestedPage = params.page ?? 1
  const requestedPageSize = params.pageSize ?? 10
  const fetchPageSize = 100
  let page = 1
  let totalCount
  let items = []

  do {
    const search = new URLSearchParams()
    search.set('page', String(page))
    search.set('pageSize', String(fetchPageSize))
    if (params.onlyDeleted) search.set('onlyDeleted', 'true')
    const data = await apiRequestAuth(`/api/users?${search.toString()}`, { method: 'GET' })
    const paged = toPagedResult(data)
    items = items.concat(paged.items)
    totalCount = paged.totalCount
    if (paged.items.length < fetchPageSize) break
    page += 1
  } while (items.length < totalCount && page <= 20)

  const filtered = items.filter((item) => {
    const employee = item.employee ?? item.Employee
    const haystack = [
      item.username ?? item.Username,
      employee?.fullName ?? employee?.FullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
  const start = (requestedPage - 1) * requestedPageSize

  return {
    items: filtered.slice(start, start + requestedPageSize),
    page: requestedPage,
    pageSize: requestedPageSize,
    totalCount: filtered.length,
  }
}

export function fetchUserById(id) {
  return apiRequestAuth(`/api/users/${id}`, { method: 'GET' })
}

export function fetchLegacySaleReview() {
  return apiRequestAuth('/api/users/legacy-sale-review', { method: 'GET' })
}

export function createUser(payload) {
  return apiRequestAuth('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id, payload) {
  return apiRequestAuth(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function lockUser(id) {
  return apiRequestAuth(`/api/users/${id}/lock`, { method: 'PUT' })
}

export function unlockUser(id) {
  return apiRequestAuth(`/api/users/${id}/unlock`, { method: 'PUT' })
}

export function softDeleteUser(id) {
  return apiRequestAuth(`/api/users/${id}`, { method: 'DELETE' })
}

export function restoreUser(id) {
  return apiRequestAuth(`/api/users/${id}/restore`, { method: 'PUT' })
}

/** @deprecated Dùng softDeleteUser */
export const deleteUser = softDeleteUser

export function assignUserRoles(id, roleIds) {
  return apiRequestAuth(`/api/users/${id}/roles`, {
    method: 'POST',
    body: JSON.stringify({ roleIds }),
  })
}

export function revokeUserRole(userId, roleId) {
  return apiRequestAuth(`/api/users/${userId}/roles/${roleId}`, { method: 'DELETE' })
}

export function fetchUserRoles(id) {
  return apiRequestAuth(`/api/users/${id}/roles`, { method: 'GET' })
}

export function changeUserPassword(id, currentPassword, newPassword) {
  return apiRequestAuth(`/api/users/${id}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function mapUser(item) {
  if (!item || typeof item !== 'object') return null

  const employee = item.employee ?? item.Employee
  return {
    id: item.id ?? item.Id,
    username: item.username ?? item.Username ?? '',
    isActive: item.isActive ?? item.IsActive ?? false,
    isDeleted: item.isDeleted ?? item.IsDeleted ?? false,
    lastLoginAt: item.lastLoginAt ?? item.LastLoginAt ?? null,
    roles: item.roles ?? item.Roles ?? [],
    employee: employee
      ? {
          id: employee.id ?? employee.Id,
          fullName: employee.fullName ?? employee.FullName ?? '',
          department: employee.department ?? employee.Department ?? '',
          status: employee.status ?? employee.Status ?? '',
        }
      : null,
  }
}
