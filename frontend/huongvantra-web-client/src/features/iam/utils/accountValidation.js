import { normalizePhoneInput, validatePhoneNumber, getPhoneMaxLength } from '../../customers/utils/customerValidation.js'

export function validateAccountPhone(phone, { required = false } = {}) {
  return validatePhoneNumber(phone, { required })
}

export { normalizePhoneInput, getPhoneMaxLength }

export function validateCreateAccountForm({ username, password, fullName, phone, roleIds, roleId }) {
  const errors = {}

  if (!String(username || '').trim()) errors.username = 'Tên đăng nhập là bắt buộc.'
  if (String(password || '').trim().length < 8) errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.'
  if (!String(fullName || '').trim()) errors.fullName = 'Họ và tên là bắt buộc.'
  const selectedRoleIds = Array.isArray(roleIds) ? roleIds : [roleId].filter(Boolean)
  if (selectedRoleIds.length === 0) errors.roleIds = 'Vui lòng chọn ít nhất một vai trò.'

  const phoneError = validateAccountPhone(phone, { required: false })
  if (phoneError) errors.phone = phoneError

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}
