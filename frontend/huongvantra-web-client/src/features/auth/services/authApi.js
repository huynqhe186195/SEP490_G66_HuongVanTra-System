import {
  apiRequest,
  apiRequestAuth,
  getPermissionsFromAccessToken,
  getUserIdFromToken,
} from '../../../lib/apiClient.js'
import { loadAuthSession } from './authSession.js'

const ROLE_MODULE_MAP = {
  admin: [
    'orders',
    'cod_ops',
    'stock_deduct_ops',
    'stock_adjustment_ops',
    'stock_transfer_ops',
    'customers',
    'contracts',
    'products',
    'product_creation_requests',
    'staff',
    'membership_tiers_admin',
    'promotions_admin',
    'system_activity_log',
    'inventory_sync_monitor',
    'users_admin',
    'phan_quyen_admin',
    'supplier_receipts',
    'warehouse_batches',
    'production_orders',
    'inventory_ledger',
    'inventory_stocktake',
    'warehouse_daily_report',
    'accounting_cost',
    'dashboard',
  ],
  manager: ['pos', 'orders', 'cod_ops', 'stock_deduct_ops', 'stock_adjustment_ops', 'stock_transfer_ops', 'customers', 'contracts', 'products', 'product_creation_requests', 'staff', 'accounting_cost', 'warehouse_daily_report', 'dashboard'],
  salepos: ['pos', 'orders', 'customers', 'stock_adjustment_ops', 'dashboard'],
  salecod: ['pos', 'cod_ops', 'customers', 'dashboard'],
  // Legacy single Sale → quầy (không COD ops).
  sale: ['pos', 'orders', 'customers', 'stock_adjustment_ops', 'dashboard'],
  warehouse: ['products', 'product_creation_requests', 'stock_adjustment_ops', 'stock_transfer_ops', 'inventory', 'inventory_statistics', 'warehouse_daily_report'],
  accountant: [
    'orders',
    'customers',
    'contracts',
    'dashboard',
    'inventory_ledger',
    'inventory_reports',
    'inventory_statistics',
    'supplier_receipts',
    'accounting_cost',
  ],
}

const ROLE_ALIAS_TO_MAP_KEY = {
  agencymanager: 'manager',
  branchmanager: 'manager',
  owner: 'manager',
  manager: 'manager',
  salesstaff: 'sale',
  sale: 'sale',
  salepos: 'salepos',
  salecod: 'salecod',
  inventorymanager: 'warehouse',
  warehousemanager: 'warehouse',
  thukho: 'warehouse',
  warehouse: 'warehouse',
  accountant: 'accountant',
  admin: 'admin',
}

function resolveRoleMapKey(role) {
  const key = normalizeRoleKey(role)
  if (ROLE_MODULE_MAP[key]) return key
  return ROLE_ALIAS_TO_MAP_KEY[key] || null
}

function normalizeRoleKey(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function deriveModulesFromRoles(roles = []) {
  const modules = new Set()

  for (const role of roles) {
    const key = resolveRoleMapKey(role)
    const mapped = key ? ROLE_MODULE_MAP[key] : null
    if (mapped) {
      mapped.forEach((module) => modules.add(module))
    }
  }

  return [...modules]
}

function mergePermissions(data, accessToken) {
  const fromResponse = data.permissions ?? data.Permissions ?? []
  const fromToken = getPermissionsFromAccessToken(accessToken)
  return [...new Set([...fromResponse, ...fromToken].map(String).filter(Boolean))]
}

export function normalizeAuthSession(data) {
  const accessToken = data.accessToken ?? data.AccessToken
  const expiresAt = data.expiresAt ?? data.ExpiresAt
  return {
    accessToken,
    refreshToken: data.refreshToken ?? data.RefreshToken,
    expiresAt,
    expiresAtUtc: expiresAt,
    username: data.username ?? data.Username ?? '',
    roles: data.roles ?? data.Roles ?? [],
    permissions: mergePermissions(data, accessToken),
    userId: getUserIdFromToken(accessToken),
  }
}

export async function login(username, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return normalizeAuthSession(data)
}

export async function refresh(_accessToken, refreshToken) {
  const token = refreshToken ?? _accessToken
  const data = await apiRequest('/api/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: token }),
  })
  return normalizeAuthSession(data)
}

export async function me(accessToken) {
  const session = loadAuthSession()
  const token = accessToken ?? session?.accessToken
  if (!token) {
    return { username: session?.username ?? '', roles: session?.roles ?? [] }
  }

  const user = await apiRequestAuth('/api/auth/me', { method: 'GET' })
  const employee = user.employee ?? user.Employee ?? null
  return {
    userId: user.id ?? user.Id ?? getUserIdFromToken(token) ?? session?.userId,
    username: user.username ?? user.Username ?? session?.username ?? '',
    fullName: employee?.fullName ?? employee?.FullName ?? '',
    roles: user.roles ?? user.Roles ?? session?.roles ?? [],
    permissions: session?.permissions ?? [],
  }
}

/** false nếu phiên bị thay bởi đăng nhập ở thiết bị khác / đã thu hồi. */
export async function checkAuthSessionActive() {
  try {
    await apiRequestAuth('/api/auth/session', { method: 'GET', silentAuthErrors: true })
    return true
  } catch {
    return false
  }
}

export async function logout(accessToken, refreshToken) {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refreshToken }),
  })
}

export async function changePassword(currentPassword, newPassword) {
  return apiRequestAuth('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
    silentAuthErrors: true,
  })
}

export async function resetPassword(username, newPassword) {
  return apiRequestAuth('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ username, newPassword }),
  })
}

export async function requestForgotPasswordOtp(phone) {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function verifyForgotPasswordOtp(phone, otp) {
  return apiRequest('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  })
}

export async function resetPasswordWithToken(resetToken, newPassword) {
  return apiRequest('/api/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify({ resetToken, newPassword }),
  })
}

export function isWarehouseUserRole(roles = []) {
  return (roles ?? []).some((role) => resolveRoleMapKey(role) === 'warehouse')
}

function hasCatalogPermission(session) {
  const permissions = session?.permissions ?? []
  return permissions.includes('MANAGE_CATALOG') || permissions.includes('MANAGE_ROLE')
}

export function enrichSessionWithAccess(session) {
  const permissions = mergePermissions(session, session?.accessToken)
  const modules = deriveModulesFromRoles(session.roles ?? []).filter((module) => {
    if (module !== 'pos') return true
    return (
      permissions.includes('CREATE_POS_ORDER')
      || permissions.includes('CREATE_COD_ORDER')
      || permissions.includes('MANAGE_EMPLOYEE')
    )
  })
  return {
    ...session,
    permissions,
    modules,
  }
}

/** Làm mới quyền từ server (JWT mới) — cần khi role/permission vừa được cập nhật trên backend. */
export async function syncSessionFromServer(session) {
  const enriched = enrichSessionWithAccess(session)
  const roleModules = deriveModulesFromRoles(enriched.roles ?? [])
  const shouldRefresh =
    enriched.refreshToken &&
    (
      (
        isWarehouseUserRole(enriched.roles) &&
        !hasCatalogPermission(enriched)
      ) ||
      (
        roleModules.includes('pos') &&
        !enriched.permissions.includes('CREATE_POS_ORDER') &&
        !enriched.permissions.includes('CREATE_COD_ORDER')
      )
    )

  if (!shouldRefresh) {
    return enriched
  }

  try {
    const refreshed = normalizeAuthSession(await refresh(enriched.accessToken, enriched.refreshToken))
    return enrichSessionWithAccess(refreshed)
  } catch {
    return enriched
  }
}
