const PHONE_REGEX = /^0\d{9}$/

export function normalizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10)
}

export function validateAccountPhone(phone, { required = false } = {}) {
  const value = String(phone || '').trim()
  if (!value) {
    return required ? 'Số điện thoại là bắt buộc.' : null
  }
  if (!PHONE_REGEX.test(value)) {
    return 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
  }
  return null
}

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
