import { parseProductPriceInput } from './productDisplay.js'
import { collectDescendantIds } from './categoryTreeUtils.js'

const SKU_CODE_REGEX = /^[A-Z0-9\-_]{3,50}$/
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

function normalizeText(value) {
  return String(value || '').trim()
}

export function normalizeSkuCodeInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '')
    .slice(0, 50)
}

export function validateCategoryForm({ name, description, parentId, categoryId, existingCategories = [] }) {
  const errors = {}
  const nameValue = normalizeText(name)
  if (!nameValue) errors.name = 'Tên danh mục là bắt buộc.'
  else if (nameValue.length < 2) errors.name = 'Tên danh mục phải có ít nhất 2 ký tự.'
  else if (nameValue.length > 100) errors.name = 'Tên danh mục tối đa 100 ký tự.'
  else {
    const normalized = nameValue.toLowerCase()
    const duplicate = existingCategories.some(
      (item) =>
        (item?.isActive ?? item?.IsActive ?? true) &&
        String(item?.name || '')
          .trim()
          .toLowerCase() === normalized &&
        Number(item?.id) !== Number(categoryId),
    )
    if (duplicate) errors.name = 'Tên danh mục đã tồn tại.'
  }

  const descriptionValue = normalizeText(description)
  if (descriptionValue.length > 500) errors.description = 'Mô tả danh mục tối đa 500 ký tự.'

  if (parentId && categoryId && Number(parentId) === Number(categoryId)) {
    errors.parentId = 'Danh mục không thể là cha của chính nó.'
  } else if (parentId && categoryId) {
    const descendants = collectDescendantIds(categoryId, existingCategories)
    if (descendants.includes(Number(parentId))) {
      errors.parentId = 'Không thể chọn danh mục con làm danh mục cha.'
    }
  }

  const messages = Object.values(errors)
  return { valid: messages.length === 0, errors, message: messages[0] || '' }
}

export function validateProductForm({ categoryId, name, origin, flavorProfile, brewingGuide, description }) {
  const errors = {}
  if (!Number(categoryId) || Number(categoryId) <= 0) errors.categoryId = 'Vui lòng chọn danh mục.'

  const nameValue = normalizeText(name)
  if (!nameValue) errors.name = 'Tên sản phẩm là bắt buộc.'
  else if (nameValue.length < 2) errors.name = 'Tên sản phẩm phải có ít nhất 2 ký tự.'
  else if (nameValue.length > 200) errors.name = 'Tên sản phẩm tối đa 200 ký tự.'

  const originValue = normalizeText(origin)
  if (originValue.length > 100) errors.origin = 'Xuất xứ tối đa 100 ký tự.'

  const flavorValue = normalizeText(flavorProfile)
  if (flavorValue.length > 500) errors.flavorProfile = 'Hương vị tối đa 500 ký tự.'

  const brewingValue = normalizeText(brewingGuide)
  if (brewingValue.length > 1000) errors.brewingGuide = 'Hướng dẫn pha chế tối đa 1000 ký tự.'

  const descriptionValue = normalizeText(description)
  if (descriptionValue.length > 2000) errors.description = 'Mô tả sản phẩm tối đa 2000 ký tự.'

  const messages = Object.values(errors)
  return { valid: messages.length === 0, errors, message: messages[0] || '' }
}

export function validateSkuForm({ skuCode, packagingType, weightInGrams, basePrice, imageUrl }) {
  const errors = {}
  const code = normalizeText(skuCode).toUpperCase()
  if (!code) errors.skuCode = 'Mã SKU là bắt buộc.'
  else if (!SKU_CODE_REGEX.test(code)) {
    errors.skuCode = 'Mã SKU chỉ được chứa chữ in hoa, chữ số, dấu - hoặc _ (3–50 ký tự).'
  }

  const packaging = normalizeText(packagingType)
  if (!packaging) errors.packagingType = 'Loại đóng gói là bắt buộc.'
  else if (packaging.length > 50) errors.packagingType = 'Loại đóng gói tối đa 50 ký tự.'

  const weight = Number(weightInGrams)
  if (!Number.isInteger(weight) || weight <= 0) errors.weightInGrams = 'Khối lượng phải là số nguyên lớn hơn 0 gram.'
  else if (weight > 100000) errors.weightInGrams = 'Khối lượng tối đa 100,000 gram (100 kg).'

  const price = parseProductPriceInput(basePrice)
  if (!Number.isFinite(price) || price <= 0) errors.basePrice = 'Giá bán phải lớn hơn 0.'
  else if (price > 1000000000) errors.basePrice = 'Giá bán tối đa 1.000.000.000 đ.'
  else if (price !== Math.round(price * 100) / 100) errors.basePrice = 'Giá bán chỉ được có tối đa 2 chữ số thập phân.'

  const image = normalizeText(imageUrl)
  if (image) {
    if (image.length > 500) errors.imageUrl = 'URL ảnh tối đa 500 ký tự.'
    else if (!URL_REGEX.test(image)) errors.imageUrl = 'URL ảnh phải bắt đầu bằng http:// hoặc https://.'
  }

  const messages = Object.values(errors)
  return { valid: messages.length === 0, errors, message: messages[0] || '' }
}

export function validatePagination(page, pageSize) {
  const errors = {}
  if (Number(page) < 1) errors.page = 'Trang phải lớn hơn hoặc bằng 1.'
  if (Number(pageSize) < 1) errors.pageSize = 'Số mục mỗi trang phải lớn hơn hoặc bằng 1.'
  else if (Number(pageSize) > 100) errors.pageSize = 'Số mục mỗi trang tối đa là 100.'
  const messages = Object.values(errors)
  return { valid: messages.length === 0, errors, message: messages[0] || '' }
}

export function mapProductApiError(message, apiErrors = []) {
  const fieldErrors = {}
  const messages = [...(Array.isArray(apiErrors) ? apiErrors : []), String(message || '').trim()].filter(Boolean)

  for (const text of messages) {
    const mapped = mapSingleProductApiError(text)
    if (mapped.field && !fieldErrors[mapped.field]) {
      fieldErrors[mapped.field] = mapped.message
    }
  }

  const firstField = Object.keys(fieldErrors)[0]
  const firstMessage = firstField ? fieldErrors[firstField] : messages[0] || 'Có lỗi xảy ra.'

  return {
    field: firstField || null,
    message: firstMessage,
    errors: fieldErrors,
  }
}

function mapSingleProductApiError(message) {
  const text = String(message || '').trim()
  if (!text) return { field: null, message: 'Có lỗi xảy ra.' }

  const lower = text.toLowerCase()
  if (lower.includes('sku') && (lower.includes('đã tồn tại') || lower.includes('already exists'))) {
    return { field: 'skuCode', message: text }
  }
  if (lower.includes('danh mục') && lower.includes('đã tồn tại')) {
    return { field: 'name', message: text }
  }
  if (lower.includes('không thể là cha của chính nó')) {
    return { field: 'parentId', message: text }
  }
  if (lower.includes('mã sku')) return { field: 'skuCode', message: text }
  if (lower.includes('loại đóng gói')) return { field: 'packagingType', message: text }
  if (lower.includes('khối lượng')) return { field: 'weightInGrams', message: text }
  if (lower.includes('giá bán')) return { field: 'basePrice', message: text }
  if (lower.includes('url ảnh')) return { field: 'imageUrl', message: text }
  if (lower.includes('tên danh mục')) return { field: 'name', message: text }
  if (lower.includes('tên sản phẩm')) return { field: 'name', message: text }
  if (lower.includes('categoryid') || lower.includes('danh mục')) return { field: 'categoryId', message: text }

  return { field: null, message: text }
}
