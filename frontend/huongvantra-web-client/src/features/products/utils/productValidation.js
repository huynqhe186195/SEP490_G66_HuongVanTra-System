import { parseProductPriceInput } from './productDisplay.js'
import { collectDescendantIds } from './categoryTreeUtils.js'

const SKU_CODE_REGEX = /^[A-Z0-9\-_]{3,50}$/
const BARCODE_REGEX = /^[A-Za-z0-9\-_]{3,100}$/
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

export function validateProductForm({
  categoryId,
  name,
  origin,
  flavorProfile,
  brewingGuide,
  description,
  baseUnit,
  weightValue,
  weightUnit,
  images = [],
  units = [],
  variants = [],
  variantGenerator,
}) {
  const errors = {}
  if (!Number(categoryId) || Number(categoryId) <= 0) errors.categoryId = 'Vui lòng chọn danh mục.'

  const nameValue = normalizeText(name)
  if (!nameValue) errors.name = 'Tên sản phẩm là bắt buộc.'
  else if (nameValue.length < 2) errors.name = 'Tên sản phẩm phải có ít nhất 2 ký tự.'
  else if (nameValue.length > 200) errors.name = 'Tên sản phẩm tối đa 200 ký tự.'

  const baseUnitValue = normalizeText(baseUnit)
  if (baseUnitValue.length > 50) errors.baseUnit = 'Đơn vị gốc tối đa 50 ký tự.'

  const weight = weightValue === '' || weightValue === null || weightValue === undefined ? null : Number(weightValue)
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) errors.weightValue = 'Khối lượng/quy cách phải lớn hơn 0.'
  const weightUnitValue = normalizeText(weightUnit)
  if (weightUnitValue.length > 50) errors.weightUnit = 'Đơn vị khối lượng tối đa 50 ký tự.'

  const originValue = normalizeText(origin)
  if (originValue.length > 100) errors.origin = 'Xuất xứ tối đa 100 ký tự.'

  const flavorValue = normalizeText(flavorProfile)
  if (flavorValue.length > 500) errors.flavorProfile = 'Hương vị tối đa 500 ký tự.'

  const brewingValue = normalizeText(brewingGuide)
  if (brewingValue.length > 1000) errors.brewingGuide = 'Hướng dẫn pha chế tối đa 1000 ký tự.'

  const descriptionValue = normalizeText(description)
  if (descriptionValue.length > 2000) errors.description = 'Mô tả sản phẩm tối đa 2000 ký tự.'

  const filledImages = images.filter((image) => normalizeText(image.imageUrl))
  const thumbnailCount = filledImages.filter((image) => image.isThumbnail).length
  if (thumbnailCount > 1) errors.images = 'Chỉ được chọn một ảnh đại diện.'
  filledImages.forEach((image, index) => {
    const url = normalizeText(image.imageUrl)
    if (url.length > 500) errors.images = `URL ảnh #${index + 1} tối đa 500 ký tự.`
    else if (!URL_REGEX.test(url)) errors.images = `URL ảnh #${index + 1} phải bắt đầu bằng http:// hoặc https://.`
  })

  const filledUnits = units.filter((unit) => normalizeText(unit.unitName))
  const baseUnitCount = filledUnits.filter((unit) => unit.isBaseUnit).length
  if (baseUnitCount > 1) errors.units = 'Chỉ được chọn một đơn vị gốc.'
  filledUnits.forEach((unit, index) => {
    const conversionRate = Number(unit.conversionRate)
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) errors.units = `Tỷ lệ quy đổi đơn vị #${index + 1} phải lớn hơn 0.`
    const price = unit.price === '' || unit.price === null || unit.price === undefined ? null : Number(unit.price)
    if (price !== null && (!Number.isFinite(price) || price < 0)) errors.units = `Giá đơn vị #${index + 1} không hợp lệ.`
    const barcode = normalizeText(unit.barcode)
    if (barcode && !BARCODE_REGEX.test(barcode)) errors.units = `Barcode đơn vị #${index + 1} không hợp lệ.`
  })

  variants.forEach((variant, index) => {
    const variantName = normalizeText(variant.variantName)
    if (!variantName) errors.variants = `Tên biến thể #${index + 1} là bắt buộc.`
    const code = normalizeText(variant.skuCode).toUpperCase()
    if (code && !SKU_CODE_REGEX.test(code)) errors.variants = `SKU biến thể #${index + 1} không hợp lệ.`
    const barcode = normalizeText(variant.barcode)
    if (barcode && !BARCODE_REGEX.test(barcode)) errors.variants = `Barcode biến thể #${index + 1} không hợp lệ.`
    const costPrice = Number(variant.costPrice)
    const retailPrice = Number(variant.retailPrice)
    if (!Number.isFinite(costPrice) || costPrice < 0) errors.variants = `Giá vốn biến thể #${index + 1} không hợp lệ.`
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) errors.variants = `Giá bán biến thể #${index + 1} phải lớn hơn 0.`
    const minStock = variant.minStock === '' ? null : Number(variant.minStock)
    const maxStock = variant.maxStock === '' ? null : Number(variant.maxStock)
    if (minStock !== null && (!Number.isInteger(minStock) || minStock < 0)) errors.variants = `Tồn tối thiểu biến thể #${index + 1} không hợp lệ.`
    if (maxStock !== null && (!Number.isInteger(maxStock) || maxStock < 0)) errors.variants = `Tồn tối đa biến thể #${index + 1} không hợp lệ.`
    if (minStock !== null && maxStock !== null && maxStock < minStock) errors.variants = `Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu ở biến thể #${index + 1}.`
  })

  if (variantGenerator?.enabled) {
    const groups = variantGenerator.optionGroups || []
    const usableGroups = groups.filter((group) => normalizeText(group.name) || normalizeText(group.valuesText))
    if (usableGroups.length) {
      usableGroups.forEach((group, index) => {
        if (!normalizeText(group.name)) errors.variantGenerator = `Tên nhóm thuộc tính #${index + 1} là bắt buộc.`
        const values = normalizeText(group.valuesText)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
        if (!values.length) errors.variantGenerator = `Nhóm thuộc tính #${index + 1} cần ít nhất một giá trị.`
      })
      const retailPrice = Number(variantGenerator.retailPrice)
      if (!Number.isFinite(retailPrice) || retailPrice <= 0) errors.variantGenerator = 'Giá bán mặc định cho biến thể tự sinh phải lớn hơn 0.'
    }
  }

  const messages = Object.values(errors)
  return { valid: messages.length === 0, errors, message: messages[0] || '' }
}

export function validateSkuForm({
  skuCode,
  barcode,
  packagingType,
  weightInGrams,
  basePrice,
  costPrice,
  retailPrice,
  minStock,
  maxStock,
  imageUrl,
  allowBlankSku = true,
}) {
  const errors = {}
  const code = normalizeText(skuCode).toUpperCase()
  if (!code && !allowBlankSku) errors.skuCode = 'Mã SKU là bắt buộc.'
  else if (code && !SKU_CODE_REGEX.test(code)) {
    errors.skuCode = 'Mã SKU chỉ được chứa chữ in hoa, chữ số, dấu - hoặc _ (3–50 ký tự).'
  }

  const barcodeValue = normalizeText(barcode)
  if (barcodeValue && !BARCODE_REGEX.test(barcodeValue)) {
    errors.barcode = 'Barcode chỉ được chứa chữ, số, dấu - hoặc _ (3–100 ký tự).'
  }

  const packaging = normalizeText(packagingType)
  if (!packaging) errors.packagingType = 'Loại đóng gói là bắt buộc.'
  else if (packaging.length > 50) errors.packagingType = 'Loại đóng gói tối đa 50 ký tự.'

  const weight = Number(weightInGrams)
  if (!Number.isInteger(weight) || weight <= 0) errors.weightInGrams = 'Khối lượng phải là số nguyên lớn hơn 0 gram.'
  else if (weight > 100000) errors.weightInGrams = 'Khối lượng tối đa 100,000 gram (100 kg).'

  const price = parseProductPriceInput(basePrice)
  if (!Number.isFinite(price) || price <= 0) errors.basePrice = 'Giá niêm yết phải lớn hơn 0.'
  else if (price > 1000000000) errors.basePrice = 'Giá niêm yết tối đa 1.000.000.000 đ.'
  else if (price !== Math.round(price * 100) / 100) errors.basePrice = 'Giá niêm yết chỉ được có tối đa 2 chữ số thập phân.'

  const cost = parseProductPriceInput(costPrice)
  if (normalizeText(costPrice) && (!Number.isFinite(cost) || cost < 0)) errors.costPrice = 'Giá vốn không hợp lệ.'

  const retail = parseProductPriceInput(retailPrice)
  if (normalizeText(retailPrice) && (!Number.isFinite(retail) || retail <= 0)) errors.retailPrice = 'Giá bán lẻ phải lớn hơn 0.'

  const min = minStock === '' || minStock === null || minStock === undefined ? null : Number(minStock)
  const max = maxStock === '' || maxStock === null || maxStock === undefined ? null : Number(maxStock)
  if (min !== null && (!Number.isInteger(min) || min < 0)) errors.minStock = 'Tồn tối thiểu phải là số nguyên không âm.'
  if (max !== null && (!Number.isInteger(max) || max < 0)) errors.maxStock = 'Tồn tối đa phải là số nguyên không âm.'
  if (min !== null && max !== null && max < min) errors.maxStock = 'Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.'

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
  const duplicateProduct = messages.some((text) => mapSingleProductApiError(text).duplicateProduct)

  return {
    field: firstField || null,
    message: firstMessage,
    errors: fieldErrors,
    duplicateProduct,
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
  if (lower.includes('sản phẩm') && lower.includes('đã tồn tại')) {
    return { field: 'name', message: text, duplicateProduct: true }
  }
  if (lower.includes('categoryid') || lower.includes('danh mục')) return { field: 'categoryId', message: text }

  return { field: null, message: text }
}
