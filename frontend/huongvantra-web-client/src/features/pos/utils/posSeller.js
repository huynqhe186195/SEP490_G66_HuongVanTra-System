import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchMyProfile } from '../../profile/services/profileApi.js'

const ROLE_LABELS = {
  Admin: 'Quản trị viên',
  'Agency Manager': 'Quản lý chi nhánh',
  'Sales Staff': 'Nhân viên bán hàng',
  'Inventory Manager': 'Quản lý kho',
  Accountant: 'Kế toán',
  Customer: 'Khách hàng',
}

export function formatRoleLabel(role) {
  if (!role) return ''
  return ROLE_LABELS[role] || role
}

export function formatRoles(roles) {
  const list = Array.isArray(roles) ? roles.filter(Boolean) : []
  if (!list.length) return ''
  return list.map(formatRoleLabel).join(', ')
}

function sellerFromSession(session) {
  const roles = session?.roles ?? []
  return {
    username: session?.username?.trim() || '',
    fullName: '',
    name: session?.username?.trim() || 'Nhân viên POS',
    role: formatRoles(roles) || '—',
  }
}

export async function loadPosSeller() {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    return { name: 'Nhân viên POS', role: '—', display: 'Nhân viên POS · —' }
  }

  try {
    const profile = await fetchMyProfile()
    const roles = profile.roles?.length ? profile.roles : session.roles ?? []
    const username = profile.username || session.username || ''
    const fullName = profile.fullName || ''
    const name = (fullName || username || 'Nhân viên POS').trim()
    const role = formatRoles(roles) || '—'
    return {
      username,
      fullName,
      name,
      role,
      display: `${name} · ${role}`,
    }
  } catch {
    const fallback = sellerFromSession(session)
    return {
      ...fallback,
      display: `${fallback.name} · ${fallback.role}`,
    }
  }
}
