import {
  createEmployee,
  deactivateEmployee,
  fetchEmployeeById,
  fetchEmployees,
  mapEmployee,
  updateEmployee,
} from '../../iam/services/employeesApi.js'
import { assignUserRoles, lockUser, unlockUser, updateUser } from '../../iam/services/usersApi.js'
import { fetchAssignableRoles, fetchRoles, mapRole } from '../../iam/services/rolesApi.js'
import { formatRoleName } from '../../iam/utils/iamLabels.js'
import { resetPassword } from '../../auth/services/authApi.js'

function mapStaffRow(employee) {
  const mapped = mapEmployee(employee)
  if (!mapped) return null

  return {
    id: mapped.employeeId,
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
  let roles
  try {
    roles = await fetchAssignableRoles()
  } catch {
    roles = await fetchRoles()
  }
  return (Array.isArray(roles) ? roles : [])
    .map(mapRole)
    .filter(Boolean)
    .map((role) => ({
      id: role.id,
      name: role.roleName,
      label: formatRoleName(role.roleName),
    }))
}

export async function fetchStaffAccounts(params = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const hasClientFilters = Boolean(params.search || typeof params.isActive === 'boolean' || params.role)

  if (hasClientFilters) {
    const rows = []
    const fetchPageSize = 100
    let fetchPage = 1
    let totalCount

    do {
      const data = await fetchEmployees({ page: fetchPage, pageSize: fetchPageSize })
      rows.push(...data.items.map(mapStaffRow).filter(Boolean))
      totalCount = data.totalCount ?? rows.length
      if (data.items.length < fetchPageSize) break
      fetchPage += 1
    } while (rows.length < totalCount && fetchPage <= 20)

    const filtered = filterStaffRows(rows, {
      search: params.search,
      isActive: params.isActive,
      role: params.role,
    })
    const start = (page - 1) * pageSize

    return {
      items: filtered.slice(start, start + pageSize),
      totalCount: filtered.length,
      page,
      pageSize,
    }
  }

  const data = await fetchEmployees({ page, pageSize })
  const rows = data.items.map(mapStaffRow).filter(Boolean)
  const filtered = filterStaffRows(rows, {
    search: params.search,
    isActive: params.isActive,
    role: params.role,
  })

  return {
    items: filtered,
    totalCount: data.totalCount ?? filtered.length,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
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
  const roleIds = resolveRoleIds(roles, payload.roles)
  if (!roleIds.length || roleIds.length !== (payload.roles || []).length) {
    throw new Error('Vai trò không hợp lệ.')
  }

  return createEmployee({
    username: payload.username,
    password: payload.password,
    roleIds,
    fullName: payload.fullName,
    department: payload.note || null,
    actualSalary: 0,
    bankAccountInfo: payload.phone || null,
  })
}

function resolveRoleIds(options, roleNames) {
  const names = (Array.isArray(roleNames) ? roleNames : [roleNames]).filter(Boolean)
  const resolved = []
  for (const name of names) {
    const direct = options.find((item) => item.name === name)?.id
    if (direct) {
      resolved.push(direct)
      continue
    }
    // Sale legacy → ưu tiên SalePos nếu có trong danh sách gán được
    if (String(name).toLowerCase() === 'sale') {
      const salePos = options.find((item) => item.name === 'SalePos')?.id
      if (salePos) resolved.push(salePos)
    }
  }
  return [...new Set(resolved)]
}

/** Chuẩn hóa role hiển thị/sửa: Sale legacy → SalePos khi option có SalePos. */
export function normalizeStaffRolesForEdit(roles, roleOptions) {
  const names = Array.isArray(roles) ? roles : []
  const optionNames = new Set((roleOptions || []).map((r) => r.name))
  const next = []
  for (const role of names) {
    if (String(role).toLowerCase() === 'sale' && optionNames.has('SalePos')) {
      if (!next.includes('SalePos')) next.push('SalePos')
      continue
    }
    if (!next.includes(role)) next.push(role)
  }
  return next
}

export async function updateStaffAccount(employeeId, payload) {
  const current = await fetchStaffAccount(employeeId)
  const nextActive = payload.isActive ?? payload.active ?? current.isActive

  await updateEmployee(employeeId, {
    fullName: payload.fullName ?? current.fullName,
    department: payload.note ?? current.department ?? null,
    actualSalary: current.actualSalary || 0,
    bankAccountInfo: payload.phone ?? current.phone ?? null,
  })

  if (!nextActive) {
    await lockUser(current.userGuid)
  } else {
    if (!current.isActive) {
      await unlockUser(current.userGuid)
    }

    if (payload.roles !== undefined || payload.role !== undefined) {
      const options = await fetchRoleOptions()
      const requestedRoles = normalizeStaffRolesForEdit(
        payload.roles ?? [payload.role],
        options,
      )
      const roleIds = resolveRoleIds(options, requestedRoles)
      if (!roleIds.length) {
        throw new Error('Vui lòng chọn ít nhất một vai trò được phép gán (Sale quầy/COD, Kế toán hoặc Thủ kho).')
      }

      await updateUser(current.userGuid, {
        isActive: true,
        roleIds,
      })
    }
  }

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
