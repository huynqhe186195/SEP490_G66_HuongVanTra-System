import { apiRequest, apiRequestAuth, getUserIdFromToken } from '../../../lib/apiClient.js'
import { loadAuthSession } from './authSession.js'

const ROLE_MODULE_MAP = {
  admin: [
    'pos',
    'orders',
    'cod_ops',
    'stock_deduct_ops',
    'customers',
    'staff',
    'membership_tiers_admin',
    'promotions_admin',
    'users_admin',
    'phan_quyen_admin',
  ],
  manager: ['pos', 'orders', 'cod_ops', 'stock_deduct_ops', 'customers', 'staff'],
  sale: ['pos', 'orders', 'customers'],
  warehouse: ['stock_deduct_ops', 'orders'],
  accountant: ['orders', 'customers', 'reports'],
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
    const key = normalizeRoleKey(role)
    const mapped = ROLE_MODULE_MAP[key]
    if (mapped) {
      mapped.forEach((module) => modules.add(module))
    }
  }

  return [...modules]
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
    permissions: data.permissions ?? data.Permissions ?? [],
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
  const userId = getUserIdFromToken(token) ?? session?.userId
  if (!userId) {
    return { username: session?.username ?? '', roles: session?.roles ?? [] }
  }

  const user = await apiRequestAuth(`/api/users/${userId}`, { method: 'GET' })
  return {
    userId: user.id ?? user.Id,
    username: user.username ?? user.Username ?? session?.username ?? '',
    roles: user.roles ?? user.Roles ?? session?.roles ?? [],
    permissions: session?.permissions ?? [],
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
  })
}

export async function resetPassword(username, newPassword) {
  return apiRequestAuth('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ username, newPassword }),
  })
}

export async function enrichSessionWithAccess(session) {
  return {
    ...session,
    modules: deriveModulesFromRoles(session.roles ?? []),
  }
}
