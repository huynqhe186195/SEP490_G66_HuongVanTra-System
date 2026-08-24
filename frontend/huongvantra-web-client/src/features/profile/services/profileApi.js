import { changePassword } from '../../auth/services/authApi.js'
import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapMyProfile(user) {
  const employee = user.employee ?? user.Employee ?? null
  return {
    userId: user.id ?? user.Id ?? null,
    username: user.username ?? user.Username ?? '',
    fullName: employee?.fullName ?? employee?.FullName ?? '',
    phone: employee?.bankAccountInfo ?? employee?.BankAccountInfo ?? '',
    note: employee?.department ?? employee?.Department ?? '',
    isActive: user.isActive ?? user.IsActive ?? true,
    roles: user.roles ?? user.Roles ?? [],
    employee,
    lastLoginAt: user.lastLoginAt ?? user.LastLoginAt ?? null,
  }
}

export async function fetchMyProfile() {
  const user = await apiRequestAuth('/api/auth/me', { method: 'GET' })
  return mapMyProfile(user)
}

export async function updateMyProfile(payload) {
  const fullName = String(payload?.fullName ?? '').trim()
  if (!fullName) throw new Error('Họ và tên không được để trống.')

  const phone = String(payload?.phone ?? '').trim()
  const note = String(payload?.note ?? '').trim()
  const currentPassword = String(payload?.currentPassword ?? '')
  const newPassword = String(payload?.newPassword ?? '')

  if (newPassword && !currentPassword) {
    throw new Error('Nhập mật khẩu hiện tại để đổi mật khẩu mới.')
  }
  if (newPassword && newPassword.length < 8) {
    throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.')
  }

  const updated = await apiRequestAuth('/api/auth/update-profile', {
    method: 'POST',
    body: JSON.stringify({
      fullName,
      phone: phone || null,
      note: note || null,
    }),
  })

  if (newPassword) {
    await changePassword(currentPassword, newPassword)
  }

  return mapMyProfile(updated)
}

export function updateMyPassword(currentPassword, newPassword) {
  return changePassword(currentPassword, newPassword)
}
