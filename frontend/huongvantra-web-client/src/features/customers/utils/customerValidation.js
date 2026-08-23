const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const DIGITS_ONLY_REGEX = /^\d+$/
const LETTERS_ONLY_REGEX = /^[\p{L}\s]+$/u
const TAX_CODE_REGEX = /^\d{10}(-\d{3})?$/

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

export function normalizePhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('02')) return digits.slice(0, 11)
  return digits.slice(0, 10)
}

export function getPhoneMaxLength(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.startsWith('02') ? 11 : 10
}

export function validatePhoneNumber(phone, { required = true } = {}) {
  const phoneValue = String(phone || '').trim()
  if (!phoneValue) {
    return required ? 'Số điện thoại là bắt buộc.' : null
  }

  if (!DIGITS_ONLY_REGEX.test(phoneValue) || !phoneValue.startsWith('0')) {
    return 'Số điện thoại chỉ gồm chữ số và bắt đầu bằng 0.'
  }

  if (phoneValue.startsWith('02')) {
    if (phoneValue.length !== 11) {
      return 'Số máy bàn phải gồm 11 chữ số và bắt đầu bằng 02.'
    }
    return null
  }

  if (phoneValue.length !== 10) {
    return 'Số di động phải gồm 10 chữ số và bắt đầu bằng 0.'
  }

  return null
}

export function normalizeTaxCodeInput(value) {
  return String(value || '')
    .replace(/\s/g, '')
    .replace(/[^0-9-]/g, '')
    .slice(0, 14)
}

export function validateTaxCode(taxCode, { required = false } = {}) {
  const value = String(taxCode || '').trim()
  if (!value) {
    return required ? 'Khách doanh nghiệp cần mã số thuế.' : null
  }

  if (!TAX_CODE_REGEX.test(value)) {
    return 'Mã số thuế không hợp lệ. Nhập 10 số hoặc 10 số-3 số chi nhánh (VD: 0312345678 hoặc 0312345678-001).'
  }

  return null
}

export function validateCustomerForm({ name, phone, email, customerType, taxCode, address }) {
  const errors = {}
  const isCorporate = String(customerType || '').toUpperCase() === 'CORPORATE'

  const fullName = normalizeText(name)
  if (!fullName) errors.name = isCorporate ? 'Tên công ty là bắt buộc.' : 'Họ tên là bắt buộc.'
  else if (fullName.length < 2) errors.name = isCorporate ? 'Tên công ty phải có ít nhất 2 ký tự.' : 'Họ tên phải có ít nhất 2 ký tự.'
  else if (fullName.length > 100) errors.name = isCorporate ? 'Tên công ty tối đa 100 ký tự.' : 'Họ tên tối đa 100 ký tự.'
  else if (!isCorporate && !isLettersOnly(fullName)) {
    errors.name = 'Họ tên chỉ được chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu).'
  }

  const addressValue = normalizeText(address)
  if (!addressValue) errors.address = 'Địa chỉ là bắt buộc.'
  else if (addressValue.length < 5) errors.address = 'Địa chỉ phải có ít nhất 5 ký tự.'
  else if (addressValue.length > 255) errors.address = 'Địa chỉ tối đa 255 ký tự.'
  else if (isDigitsOnly(addressValue)) errors.address = 'Địa chỉ không được chỉ gồm chữ số.'

  const phoneError = validatePhoneNumber(phone)
  if (phoneError) errors.phone = phoneError

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

  const taxCodeError = validateTaxCode(taxCode, { required: isCorporate })
  if (taxCodeError) errors.taxCode = taxCodeError

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
  if (lower.includes('mã số thuế') || lower.includes('tax code')) {
    return { field: 'taxCode', message: text }
  }
  if (lower.includes('điện thoại') || lower.includes('phone number') || lower.includes('số điện thoại')) {
    return { field: 'phone', message: text }
  }
  if (lower.includes('phụ trách') || lower.includes('quản lý')) {
    return { field: 'phone', message: text }
  }

  return { field: null, message: text }
}

export function validatePosCustomerForm({ fullName, phone, address, email }) {
  const errors = {}
  const nameValue = normalizeText(fullName)
  if (!nameValue) errors.fullName = 'Họ tên là bắt buộc.'
  else if (nameValue.length < 2) errors.fullName = 'Họ tên phải có ít nhất 2 ký tự.'
  else if (nameValue.length > 100) errors.fullName = 'Họ tên tối đa 100 ký tự.'
  else if (!isLettersOnly(nameValue)) errors.fullName = 'Họ tên chỉ được chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu).'

  const phoneError = validatePhoneNumber(phone)
  if (phoneError) errors.phone = phoneError

  const emailValue = normalizeText(email)
  if (emailValue) {
    if (emailValue.length > 100) errors.email = 'Email tối đa 100 ký tự.'
    else if (!EMAIL_REGEX.test(emailValue)) errors.email = 'Email không đúng định dạng.'
  }

  const addressValue = normalizeText(address)
  if (addressValue) {
    if (addressValue.length < 5) errors.address = 'Địa chỉ phải có ít nhất 5 ký tự.'
    else if (addressValue.length > 255) errors.address = 'Địa chỉ tối đa 255 ký tự.'
    else if (isDigitsOnly(addressValue)) errors.address = 'Địa chỉ không được chỉ gồm chữ số.'
  }

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}

export function validateCustomerAddressForm(form) {
  const errors = {}

  const receiverName = normalizeText(form.receiverName)
  if (!receiverName) errors.receiverName = 'Tên người nhận là bắt buộc.'
  else if (receiverName.length < 2) errors.receiverName = 'Tên người nhận phải có ít nhất 2 ký tự.'
  else if (receiverName.length > 100) errors.receiverName = 'Tên người nhận tối đa 100 ký tự.'
  else if (!isLettersOnly(receiverName)) errors.receiverName = 'Tên người nhận chỉ được chứa chữ cái và khoảng trắng.'

  const receiverPhone = String(form.receiverPhone || '').trim()
  const receiverPhoneError = validatePhoneNumber(receiverPhone, { required: false })
  if (receiverPhoneError) {
    errors.receiverPhone = receiverPhoneError.replace('Số điện thoại', 'Số điện thoại người nhận')
  }

  const addressLine = normalizeText(form.addressLine)
  if (!addressLine) errors.addressLine = 'Địa chỉ (số nhà, đường) là bắt buộc.'
  else if (addressLine.length < 5) errors.addressLine = 'Địa chỉ phải có ít nhất 5 ký tự.'
  else if (addressLine.length > 255) errors.addressLine = 'Địa chỉ tối đa 255 ký tự.'
  else if (isDigitsOnly(addressLine)) errors.addressLine = 'Địa chỉ không được chỉ gồm chữ số.'

  const ward = normalizeText(form.ward)
  if (!ward) errors.ward = 'Phường / xã là bắt buộc.'
  else if (ward.length > 100) errors.ward = 'Phường / xã tối đa 100 ký tự.'

  const district = normalizeText(form.district)
  if (!district) errors.district = 'Quận / huyện là bắt buộc.'
  else if (district.length > 100) errors.district = 'Quận / huyện tối đa 100 ký tự.'

  const province = normalizeText(form.province)
  if (!province) errors.province = 'Tỉnh / thành phố là bắt buộc.'
  else if (province.length > 100) errors.province = 'Tỉnh / thành phố tối đa 100 ký tự.'

  const messages = Object.values(errors)
  return {
    valid: messages.length === 0,
    errors,
    message: messages[0] || '',
  }
}
