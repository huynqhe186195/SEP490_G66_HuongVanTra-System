import {
  createEmployee,
  deactivateEmployee,
  fetchEmployeeById,
  fetchEmployees,
  mapEmployee,
  updateEmployee,
} from '../../iam/services/employeesApi.js'
import { assignUserRoles, updateUser } from '../../iam/services/usersApi.js'
import { fetchRoles, mapRole } from '../../iam/services/rolesApi.js'
import { resetPassword } from '../../auth/services/authApi.js'

function mapStaffRow(employee) {
  const mapped = mapEmployee(employee)
  if (!mapped) return null

  return {
    employeeId: mapped.employeeId,
    userId: mapped.employeeId,
    userGuid: mapped.userId,
    fullName: mapped.fullName,
    phone: mapped.bankAccountInfo || '',
    username: mapped.username,
    department: mapped.department,
    roles: mapped.roles ?? [],
    isActive: mapped.isActive,
    status: mapped.status,
  }
}

function filterStaffRows(rows, params = {}) {
  let result = rows

  if (params.search) {
    const keyword = params.search.toLowerCase()
    result = result.filter(
      (item) =>
        item.fullName.toLowerCase().includes(keyword) ||
        item.username.toLowerCase().includes(keyword) ||
        item.phone.toLowerCase().includes(keyword),
    )
  }

  if (typeof params.isActive === 'boolean') {
    result = result.filter((item) => item.isActive === params.isActive)
  }

  if (params.role) {
    const roleName = String(params.role).toLowerCase()
    result = result.filter((item) =>
      (item.roles || []).some((role) => String(role).toLowerCase() === roleName),
    )
  }

  return result
}

export async function fetchRoleOptions() {
  const roles = await fetchRoles()
  return (Array.isArray(roles) ? roles : [])
    .map(mapRole)
    .filter(Boolean)
    .map((role) => ({
      id: role.id,
      name: role.roleName,
      label: role.roleName,
    }))
}

export async function fetchStaffAccounts(params = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const data = await fetchEmployees({ page: 1, pageSize: 200 })
  const rows = data.items.map(mapStaffRow).filter(Boolean)
  const filtered = filterStaffRows(rows, params)
  const start = (page - 1) * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount: filtered.length,
    page,
    pageSize,
  }
}

export async function fetchStaffAccount(employeeId) {
  const employee = await fetchEmployeeById(employeeId)
  const mapped = mapEmployee(employee)

  return {
    employeeId: mapped.employeeId,
    userId: mapped.employeeId,
    userGuid: mapped.userId,
    fullName: mapped.fullName,
    phone: mapped.bankAccountInfo || '',
    username: mapped.username,
    employeeCode: String(mapped.employeeId),
    department: mapped.department,
    roles: mapped.roles ?? [],
    note: '',
    isActive: mapped.isActive,
    status: mapped.status,
  }
}

export async function createStaffAccount(payload) {
  const roles = await fetchRoleOptions()
  const role = roles.find((item) => item.name === payload.roles?.[0])
  if (!role) {
    throw new Error('Vai trò không hợp lệ.')
  }

  return createEmployee({
    username: payload.username,
    password: payload.password,
    roleIds: [role.id],
    fullName: payload.fullName,
    department: payload.note || null,
    actualSalary: 0,
    bankAccountInfo: payload.phone || null,
  })
}

export async function updateStaffAccount(employeeId, payload) {
  const current = await fetchStaffAccount(employeeId)
  const options = await fetchRoleOptions()

  await updateEmployee(employeeId, {
    fullName: payload.fullName,
    department: payload.note || current.department || null,
    actualSalary: current.actualSalary || 0,
    bankAccountInfo: payload.phone || current.phone || null,
  })

  const roleIds = (current.roles || [])
    .map((name) => options.find((item) => item.name === name)?.id)
    .filter(Boolean)

  await updateUser(current.userGuid, {
    isActive: payload.isActive ?? payload.active ?? current.isActive,
    roleIds,
  })

  if (payload.newPassword?.trim()) {
    await resetPassword(current.username, payload.newPassword.trim())
  }
}

export async function assignStaffRoles(employeeId, roles) {
  const current = await fetchStaffAccount(employeeId)
  const options = await fetchRoleOptions()
  const roleIds = roles
    .map((name) => options.find((item) => item.name === name)?.id)
    .filter(Boolean)

  if (!roleIds.length) {
    throw new Error('Vai trò không hợp lệ.')
  }

  return assignUserRoles(current.userGuid, roleIds)
}

export { deactivateEmployee as deactivateStaffAccount }
