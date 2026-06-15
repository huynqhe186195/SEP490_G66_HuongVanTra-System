import { normalizePhoneInput, validatePhoneNumber } from '../../customers/utils/customerValidation.js'

export function validateAccountPhone(phone, { required = false } = {}) {
  return validatePhoneNumber(phone, { required })
}

export { normalizePhoneInput }

export function validateCreateAccountForm({ username, password, fullName, phone, roleId }) {
  const errors = {}

  if (!String(username || '').trim()) errors.username = 'Tên đăng nhập là bắt buộc.'
  if (String(password || '').trim().length < 6) errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.'
  if (!String(fullName || '').trim()) errors.fullName = 'Họ và tên là bắt buộc.'
  if (!roleId) errors.roleId = 'Vui lòng chọn một vai trò.'

  const phoneError = validateAccountPhone(phone, { required: false })
  if (phoneError) errors.phone = phoneError

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}
