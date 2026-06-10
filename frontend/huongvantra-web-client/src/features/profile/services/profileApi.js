import { loadAuthSession } from '../../auth/services/authSession.js'
import { changePassword } from '../../auth/services/authApi.js'
import { apiRequestAuth } from '../../../lib/apiClient.js'

export async function fetchMyProfile() {
  const session = loadAuthSession()
  if (!session?.accessToken) {
    throw new Error('Không tìm thấy thông tin phiên đăng nhập.')
  }

  const user = await apiRequestAuth('/api/auth/me', { method: 'GET' })
  const employee = user.employee ?? user.Employee ?? null
  return {
    userId: user.id ?? user.Id ?? session.userId,
    username: user.username ?? user.Username,
    fullName: employee?.fullName ?? employee?.FullName ?? '',
    isActive: user.isActive ?? user.IsActive,
    roles: user.roles ?? user.Roles ?? session.roles ?? [],
    employee,
    lastLoginAt: user.lastLoginAt ?? user.LastLoginAt ?? null,
  }
}

export async function updateMyProfile(_payload) {
  throw new Error('Cập nhật hồ sơ cá nhân chưa được hỗ trợ qua API hiện tại.')
}

export function updateMyPassword(currentPassword, newPassword) {
  return changePassword(currentPassword, newPassword)
}
