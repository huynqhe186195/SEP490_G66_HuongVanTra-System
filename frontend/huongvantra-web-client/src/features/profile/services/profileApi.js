import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchUserById } from '../../iam/services/usersApi.js'
import { changePassword } from '../../auth/services/authApi.js'

export async function fetchMyProfile() {
  const session = loadAuthSession()
  if (!session?.userId) {
    throw new Error('Không tìm thấy thông tin phiên đăng nhập.')
  }

  const user = await fetchUserById(session.userId)
  return {
    userId: user.id ?? user.Id,
    username: user.username ?? user.Username,
    isActive: user.isActive ?? user.IsActive,
    roles: user.roles ?? user.Roles ?? [],
    employee: user.employee ?? user.Employee ?? null,
    lastLoginAt: user.lastLoginAt ?? user.LastLoginAt ?? null,
  }
}

export async function updateMyProfile(_payload) {
  throw new Error('Cập nhật hồ sơ cá nhân chưa được hỗ trợ qua API hiện tại.')
}

export function updateMyPassword(currentPassword, newPassword) {
  return changePassword(currentPassword, newPassword)
}
