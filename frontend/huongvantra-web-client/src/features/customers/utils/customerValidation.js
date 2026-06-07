const PHONE_REGEX = /^0\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const DIGITS_ONLY_REGEX = /^\d+$/
const LETTERS_ONLY_REGEX = /^[\p{L}\s]+$/u

function normalizeText(value) {
  return String(value || '').normalize('NFC').trim()
}

function isDigitsOnly(value) {
  return DIGITS_ONLY_REGEX.test(normalizeText(value))
}

function isLettersOnly(value) {
  const text = normalizeText(value)
  return LETTERS_ONLY_REGEX.test(text) && /\p{L}/u.test(text)
}

export function normalizeNameInput(value) {
  return String(value || '').normalize('NFC')
}

export function validateCustomerForm({ name, phone, email, address, customerType, taxCode }) {
  const errors = {}

  const fullName = normalizeText(name)
  if (!fullName) errors.name = 'Họ tên là bắt buộc.'
  else if (fullName.length < 2) errors.name = 'Họ tên phải có ít nhất 2 ký tự.'
  else if (fullName.length > 100) errors.name = 'Họ tên tối đa 100 ký tự.'
  else if (!isLettersOnly(fullName)) errors.name = 'Họ tên chỉ được chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu).'

  const phoneValue = String(phone || '').trim()
  if (!phoneValue) errors.phone = 'Số điện thoại là bắt buộc.'
  else if (!PHONE_REGEX.test(phoneValue)) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'

  const emailValue = String(email || '').trim()
  if (emailValue) {
    if (emailValue.length > 100) {
      errors.email =
        'Email không đúng định dạng. Vui lòng nhập theo mẫu ten@domain.com (ví dụ: nguyenvana@gmail.com), tối đa 100 ký tự.'
    } else if (!EMAIL_REGEX.test(emailValue)) {
      errors.email =
        'Email không đúng định dạng. Vui lòng nhập đầy đủ phần tên, ký tự @ và tên miền (ví dụ: nguyenvana@gmail.com).'
    }
  }

  const addressValue = String(address || '').trim()
  if (!addressValue) errors.address = 'Địa chỉ là bắt buộc.'
  else if (addressValue.length < 5) errors.address = 'Địa chỉ phải có ít nhất 5 ký tự.'
  else if (addressValue.length > 255) errors.address = 'Địa chỉ tối đa 255 ký tự.'
  else if (isDigitsOnly(addressValue)) errors.address = 'Địa chỉ không được chỉ gồm chữ số.'

  if (String(customerType || '').toUpperCase() === 'CORPORATE' && !String(taxCode || '').trim()) {
    errors.taxCode = 'Khách doanh nghiệp cần mã số thuế.'
  }

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}

export function mapCustomerApiError(message) {
  const text = String(message || '').trim()
  if (!text) return { field: null, message: 'Có lỗi xảy ra.' }

  const lower = text.toLowerCase()
  if (lower.includes('email') && (lower.includes('đã') || lower.includes('already') || lower.includes('duplicate'))) {
    return { field: 'email', message: text }
  }
  if (lower.includes('điện thoại') || lower.includes('phone number')) {
    return { field: 'phone', message: text }
  }

  return { field: null, message: text }
}

export function normalizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10)
}
