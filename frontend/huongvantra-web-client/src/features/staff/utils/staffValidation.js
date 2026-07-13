import { getPhoneMaxLength, normalizePhoneInput, validatePhoneNumber } from '../../customers/utils/customerValidation.js'

export { normalizePhoneInput, getPhoneMaxLength }

export function validateStaffPhone(phone, { required = false } = {}) {
  return validatePhoneNumber(phone, { required })
}

export function validateStaffCreateForm({ fullName, phone, username, password, role }) {
  const errors = {}

  if (!String(fullName || '').trim()) errors.fullName = 'Họ và tên là bắt buộc.'
  if (!String(username || '').trim()) errors.username = 'Tên đăng nhập là bắt buộc.'
  if (String(password || '').trim().length < 6) errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.'
  if (!role) errors.role = 'Vui lòng chọn vai trò.'

  const phoneError = validateStaffPhone(phone, { required: true })
  if (phoneError) errors.phone = phoneError

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}

export function validateStaffEditForm({ fullName, phone, role, allowRoleChange, active }) {
  const errors = {}

  if (active && !String(fullName || '').trim()) {
    errors.fullName = 'Họ và tên là bắt buộc.'
  }

  const phoneError = validateStaffPhone(phone, { required: false })
  if (phoneError) errors.phone = phoneError

  if (allowRoleChange && active && !role) {
    errors.role = 'Vui lòng chọn vai trò.'
  }

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}
