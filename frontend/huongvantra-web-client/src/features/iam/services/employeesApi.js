import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function fetchEmployees(params = {}) {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))
  const query = search.toString()
  const path = query ? `/api/employees?${query}` : '/api/employees'
  return apiRequestAuth(path, { method: 'GET' }).then(toPagedResult)
}

export function fetchSalesAssignees() {
  return apiRequestAuth('/api/employees/sales-assignees', { method: 'GET' }).then((data) =>
    Array.isArray(data)
      ? data
          .map((item) => ({
            userId: item.userId ?? item.UserId,
            fullName: item.fullName ?? item.FullName ?? '',
            department: item.department ?? item.Department ?? '',
          }))
          .filter((item) => item.userId)
      : [],
  )
}

export function fetchManagerAssignees() {
  return apiRequestAuth('/api/employees/manager-assignees', { method: 'GET' }).then((data) =>
    Array.isArray(data)
      ? data
          .map((item) => ({
            userId: item.userId ?? item.UserId,
            fullName: item.fullName ?? item.FullName ?? '',
            department: item.department ?? item.Department ?? '',
          }))
          .filter((item) => item.userId)
      : [],
  )
}

export function fetchEmployeeById(id) {
  return apiRequestAuth(`/api/employees/${id}`, { method: 'GET' })
}

export function createEmployee(payload) {
  return apiRequestAuth('/api/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEmployee(id, payload) {
  return apiRequestAuth(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deactivateEmployee(id) {
  return apiRequestAuth(`/api/employees/${id}/deactivate`, { method: 'PUT' })
}

export function mapEmployee(item) {
  if (!item || typeof item !== 'object') return null

  return {
    employeeId: item.id ?? item.Id,
    userId: item.userId ?? item.UserId,
    username: item.username ?? item.Username ?? '',
    fullName: item.fullName ?? item.FullName ?? '',
    department: item.department ?? item.Department ?? '',
    actualSalary: Number(item.actualSalary ?? item.ActualSalary ?? 0),
    phoneNumber: item.phoneNumber ?? item.PhoneNumber ?? '',
    bankAccountInfo: item.bankAccountInfo ?? item.BankAccountInfo ?? '',
    status: item.status ?? item.Status ?? 'Active',
    isActive: Boolean(item.isUserActive ?? item.IsUserActive ?? true),
    roles: Array.isArray(item.roles ?? item.Roles) ? (item.roles ?? item.Roles) : [],
  }
}
