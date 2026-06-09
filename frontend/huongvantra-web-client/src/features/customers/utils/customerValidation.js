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

export function validateCustomerForm({ name, phone, email, customerType, taxCode }) {
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

export function validatePosCustomerForm({ fullName, phone, address }) {
  const errors = {}
  const nameValue = normalizeText(fullName)
  if (!nameValue) errors.fullName = 'Họ tên là bắt buộc.'
  else if (nameValue.length < 2) errors.fullName = 'Họ tên phải có ít nhất 2 ký tự.'
  else if (nameValue.length > 100) errors.fullName = 'Họ tên tối đa 100 ký tự.'
  else if (!isLettersOnly(nameValue)) errors.fullName = 'Họ tên chỉ được chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu).'

  const phoneValue = String(phone || '').trim()
  if (!phoneValue) errors.phone = 'Số điện thoại là bắt buộc.'
  else if (!PHONE_REGEX.test(phoneValue)) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'

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
  if (receiverPhone && !PHONE_REGEX.test(receiverPhone)) {
    errors.receiverPhone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
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
