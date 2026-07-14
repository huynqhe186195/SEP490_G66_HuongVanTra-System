import { useEffect, useMemo, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  authorizeProductApprovalRequest,
  buildCreateProductBody,
  cancelProductApprovalRequest,
  createProductApprovalRequest,
  fetchProductApprovals,
} from '../services/productsApi.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { fetchAllActiveSkus } from '../services/productSkusApi.js'
import { searchMaterials } from '../services/bomApi.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'
import {
  flattenCategoryTreeForSelect,
  getCategoryById,
  getCategoryPathLabel,
} from '../utils/categoryTreeUtils.js'

const PRODUCT_TYPES = [
  { value: 'THANH_PHAM', label: 'Thành phẩm' },
  { value: 'NGUYEN_LIEU', label: 'Nguyên liệu' },
]

const DEFAULT_MAX_STOCK = '999999999'
const SKU_PATTERN = /^[A-Z0-9\-_]{3,50}$/
const MAX_VARIANT_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_VARIANT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const BASE_UNIT_OPTIONS = ['gói', 'túi', 'hộp', 'chai', 'lọ', 'hũ', 'thùng', 'cái', 'bộ', 'kg', 'g', 'lít', 'ml']
const MEASUREMENT_UNIT_OPTIONS = ['g', 'kg', 'ml', 'lít']

function createKey(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function createUnit(overrides = {}) {
  return {
    key: createKey('unit'),
    unitName: 'gói',
    conversionRate: '1',
    price: '0',
    barcode: '',
    isDirectSell: true,
    isBaseUnit: true,
    ...overrides,
  }
}

function createOptionRow(overrides = {}) {
  return {
    key: createKey('option'),
    name: 'Quy cách',
    value: 'gói',
    ...overrides,
  }
}

function createBomLine(overrides = {}) {
  return {
    key: createKey('bom'),
    materialId: '',
    materialName: '',
    materialUnitName: '',
    quantity: '1',
    ...overrides,
  }
}

function createVariant(overrides = {}) {
  return {
    key: createKey('variant'),
    autoSku: true,
    skuCode: '',
    barcode: '',
    variantName: '',
    costPrice: '0',
    retailPrice: '',
    retailPriceTouched: false,
    minStock: '0',
    maxStock: DEFAULT_MAX_STOCK,
    isSellable: true,
    allowRewardPoints: true,
    isActive: true,
    imageUrl: '',
    imagePreviewUrl: '',
    imageFileName: '',
    optionRows: [createOptionRow()],
    bomLines: [],
    ...overrides,
  }
}

function createInitialForm() {
  return {
    name: '',
    categoryId: '',
    productType: 'THANH_PHAM',
    baseUnit: 'gói',
    weightValue: '',
    weightUnit: 'g',
    origin: '',
    flavorProfile: '',
    brewingGuide: '',
    description: '',
    units: [createUnit()],
    variants: [createVariant()],
    adminNotes: '',
  }
}

function trimText(value) {
  return String(value ?? '').trim()
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCurrency(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toLocaleString('vi-VN') : '0'
}

function parseVndCurrencyInput(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function formatVndCurrencyInput(value) {
  const digits = parseVndCurrencyInput(value)
  if (!digits) return ''
  return `${Number(digits).toLocaleString('vi-VN')} đ`
}

function CurrencyInput({ value, onChange, className, placeholder = '0 đ' }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={formatVndCurrencyInput(value)}
      onChange={(event) => onChange(parseVndCurrencyInput(event.target.value))}
    />
  )
}

function normalizeSkuInput(value) {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '')
}

function normalizeSkuSegment(value) {
  return String(value ?? '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildAutoSkuBase(form, variant) {
  const prefix = form.productType === 'NGUYEN_LIEU' ? 'RM' : 'FG'
  const nameSegment = normalizeSkuSegment(form.name).slice(0, 28) || 'SKU'
  const weightSegment = form.weightValue && form.weightUnit
    ? normalizeSkuSegment(`${form.weightValue}${form.weightUnit}`)
    : normalizeSkuSegment(form.baseUnit)
  const optionSegment = normalizeSkuSegment(
    variant.optionRows
      ?.map((row) => row.value)
      .filter(Boolean)
      .join('-'),
  )
  return [prefix, nameSegment, weightSegment || optionSegment].filter(Boolean).join('-').replace(/-+/g, '-')
}

function makeUniqueSku(baseSku, usedSkuCodes, existingSkuCodes) {
  let candidate = baseSku || 'SKU'
  let suffix = 1
  while (usedSkuCodes.has(candidate) || existingSkuCodes.has(candidate)) {
    candidate = `${baseSku || 'SKU'}-${suffix}`
    suffix += 1
  }
  usedSkuCodes.add(candidate)
  return candidate
}

function resolveVariantSku(form, variant, usedSkuCodes, existingSkuCodes) {
  const manualSku = normalizeSkuInput(variant.skuCode)
  if (!variant.autoSku && manualSku) {
    usedSkuCodes.add(manualSku)
    return manualSku
  }
  return makeUniqueSku(buildAutoSkuBase(form, variant), usedSkuCodes, existingSkuCodes)
}

function previewSkuForVariant(form, variantKey, existingSkuCodes) {
  const usedSkuCodes = new Set()
  for (const variant of form.variants) {
    const skuCode = resolveVariantSku(form, variant, usedSkuCodes, existingSkuCodes)
    if (variant.key === variantKey) return skuCode
  }
  return ''
}

function getProductTypeLabel(value) {
  return PRODUCT_TYPES.find((item) => item.value === value)?.label || value || '-'
}

function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    yellow: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-orange-200 bg-orange-50 text-orange-800',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  )
}

function statusTone(status) {
  switch (status) {
    case 'Draft':
      return 'yellow'
    case 'AwaitingWarehouseConfirmation':
      return 'blue'
    case 'Completed':
      return 'green'
    case 'Cancelled':
      return 'neutral'
    case 'Rejected':
      return 'red'
    case 'Expired':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function productTypeTone(value) {
  return value === 'NGUYEN_LIEU' ? 'amber' : value === 'THANH_PHAM' ? 'green' : 'neutral'
}

function statusLabel(status) {
  switch (status) {
    case 'Draft':
      return 'Chưa cấp mã'
    case 'AwaitingWarehouseConfirmation':
      return 'Đã cấp mã'
    case 'Completed':
      return 'Đã dùng'
    case 'Cancelled':
      return 'Đã hủy'
    case 'Rejected':
      return 'Từ chối'
    case 'Expired':
      return 'Hết hạn'
    default:
      return status || '-'
  }
}

function getCategoryName(categories, categoryId, fallbackName) {
  return getCategoryPathLabel(categories, categoryId, fallbackName, '-')
}

function getDefaultUnitPriceSource(units = []) {
  return units.find((unit) => unit.isBaseUnit && unit.isDirectSell)
    || units.find((unit) => unit.isBaseUnit)
    || units.find((unit) => unit.isDirectSell)
    || units[0]
}

function getDefaultSkuPrice(form) {
  return getDefaultUnitPriceSource(form.units)?.price ?? ''
}

function getMaterialUnit(material) {
  const baseUnit = material?.units?.find((unit) => unit.isBaseUnit) || material?.units?.[0]
  return material?.materialUnitName || material?.baseUnit || baseUnit?.unitName || ''
}

function buildOptionValuesJson(optionRows = []) {
  const values = {}
  for (const row of optionRows) {
    const name = trimText(row.name)
    const value = trimText(row.value)
    if (name && value) values[name] = value
  }
  return JSON.stringify(values)
}

function syncWeightOptionRows(variants, weightValue, weightUnit) {
  const weight = trimText(weightValue)
  const unit = trimText(weightUnit)
  const weightLabel = weight ? `${weight}${unit}` : ''
  return variants.map((variant) => {
    const hasWeightOption = variant.optionRows.some((option) => option.name === 'Khối lượng')
    if (!weightLabel) {
      return {
        ...variant,
        optionRows: variant.optionRows.filter((option) => option.name !== 'Khối lượng'),
      }
    }
    return {
      ...variant,
      optionRows: hasWeightOption
        ? variant.optionRows.map((option) => (option.name === 'Khối lượng' ? { ...option, value: weightLabel } : option))
        : [...variant.optionRows, createOptionRow({ name: 'Khối lượng', value: weightLabel })],
    }
  })
}

function buildProductSnapshot(form, existingSkuCodes = new Set()) {
  const usedSkuCodes = new Set()
  const product = {
    categoryId: Number(form.categoryId),
    name: trimText(form.name),
    origin: trimText(form.origin) || null,
    flavorProfile: trimText(form.flavorProfile) || null,
    brewingGuide: trimText(form.brewingGuide) || null,
    description: trimText(form.description) || null,
    baseUnit: trimText(form.baseUnit),
    weightValue: numberOrNull(form.weightValue),
    weightUnit: trimText(form.weightUnit) || null,
    isVariantParent: form.variants.length > 1,
    productType: form.productType,
    images: [],
    units: form.units.map((unit) => ({
      variantId: null,
      unitName: trimText(unit.unitName),
      conversionRate: Number(unit.conversionRate),
      price: numberOrNull(unit.price),
      barcode: trimText(unit.barcode) || null,
      isDirectSell: Boolean(unit.isDirectSell),
      isBaseUnit: Boolean(unit.isBaseUnit),
    })),
    variants: form.variants.map((variant) => ({
      skuCode: resolveVariantSku(form, variant, usedSkuCodes, existingSkuCodes),
      barcode: trimText(variant.barcode) || null,
      variantName: trimText(variant.variantName),
      optionValuesJson: buildOptionValuesJson(variant.optionRows),
      costPrice: Number(variant.costPrice || 0),
      retailPrice: Number(variant.retailPrice || 0),
      minStock: numberOrNull(variant.minStock),
      maxStock: numberOrNull(variant.maxStock),
      isSellable: Boolean(variant.isSellable),
      allowRewardPoints: Boolean(variant.allowRewardPoints),
      isActive: variant.isActive !== false,
      imageUrl: trimText(variant.imageUrl) || null,
      units: [],
      bomLines: form.productType === 'THANH_PHAM'
        ? variant.bomLines.map((line) => ({
          materialId: line.materialId,
          quantity: Number(line.quantity),
        }))
        : [],
    })),
    variantGenerator: null,
  }

  return buildCreateProductBody(product)
}

function validateApprovalForm(form, { existingSkuCodes, categories = [] }) {
  const errors = {}
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = message
  }

  const name = trimText(form.name)
  if (!name) addError('name', 'Tên sản phẩm là bắt buộc.')
  else if (name.length < 2 || name.length > 150) addError('name', 'Tên sản phẩm phải từ 2 đến 150 ký tự.')

  if (!form.categoryId) {
    addError('categoryId', 'Vui lòng chọn nhóm hàng / danh mục.')
  } else if (categories.length) {
    const category = getCategoryById(categories, form.categoryId)
    if (!category || category.isDeleted || category.isActive === false) {
      addError('categoryId', 'Danh mục trong biên bản không còn tồn tại hoặc đã bị vô hiệu hóa.')
    }
  }
  if (!form.productType) addError('productType', 'Loại hàng là bắt buộc.')
  if (!trimText(form.baseUnit)) addError('baseUnit', 'Đơn vị gốc là bắt buộc.')

  if (trimText(form.weightValue)) {
    const weightText = trimText(form.weightValue)
    const weight = Number(weightText)
    if (!/^[1-9]\d*$/.test(weightText) || !Number.isFinite(weight)) addError('weightValue', 'Khối lượng phải là số nguyên dương.')
    if (!trimText(form.weightUnit)) addError('weightUnit', 'Đơn vị khối lượng là bắt buộc khi nhập khối lượng.')
  }

  if (trimText(form.adminNotes).length > 1000) addError('adminNotes', 'Ghi chú Admin tối đa 1000 ký tự.')

  if (!form.units.length) addError('units', 'Cần ít nhất một đơn vị bán.')
  const baseUnits = form.units.filter((unit) => unit.isBaseUnit)
  if (form.units.length && baseUnits.length !== 1) addError('units', 'Cần chọn đúng một đơn vị gốc.')

  const unitNames = new Set()
  const unitBarcodes = new Set()
  form.units.forEach((unit) => {
    const prefix = `unit.${unit.key}`
    const unitName = trimText(unit.unitName).toLowerCase()
    if (!unitName) addError(`${prefix}.unitName`, 'Tên đơn vị là bắt buộc.')
    else if (unitNames.has(unitName)) addError(`${prefix}.unitName`, 'Tên đơn vị bị trùng.')
    else unitNames.add(unitName)

    const conversionRate = Number(unit.conversionRate)
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) addError(`${prefix}.conversionRate`, 'Tỷ lệ quy đổi phải lớn hơn 0.')
    if (unit.isBaseUnit && conversionRate !== 1) addError(`${prefix}.conversionRate`, 'Đơn vị gốc phải có tỷ lệ quy đổi bằng 1.')

    if (unit.isDirectSell && trimText(unit.price) === '') addError(`${prefix}.price`, 'Đơn vị bán trực tiếp cần có giá bán.')
    const price = Number(unit.price || 0)
    if (!Number.isFinite(price) || price < 0) addError(`${prefix}.price`, 'Giá bán phải lớn hơn hoặc bằng 0.')
    if (unit.isDirectSell && price <= 0) addError(`${prefix}.price`, 'Giá bán đơn vị bán phải lớn hơn 0.')

    const barcode = trimText(unit.barcode).toLowerCase()
    if (barcode) {
      if (unitBarcodes.has(barcode)) addError(`${prefix}.barcode`, 'Barcode đơn vị bị trùng.')
      else unitBarcodes.add(barcode)
    }
  })

  if (!form.variants.length) addError('variants', 'Cần ít nhất một SKU/Biến thể.')
  const skuCodes = new Set()
  const variantBarcodes = new Set()

  form.variants.forEach((variant) => {
    const prefix = `variant.${variant.key}`
    const skuCode = variant.autoSku ? makeUniqueSku(buildAutoSkuBase(form, variant), skuCodes, existingSkuCodes) : normalizeSkuInput(variant.skuCode)
    if (!skuCode) addError(`${prefix}.skuCode`, 'Mã SKU không được để trống.')
    else if (!SKU_PATTERN.test(skuCode)) addError(`${prefix}.skuCode`, 'SKU chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới, 3-50 ký tự.')
    else if (!variant.autoSku && skuCodes.has(skuCode)) addError(`${prefix}.skuCode`, 'Mã SKU bị trùng trong biên bản.')
    else if (!variant.autoSku && existingSkuCodes.has(skuCode)) addError(`${prefix}.skuCode`, 'Mã SKU đã tồn tại.')
    else if (!variant.autoSku) skuCodes.add(skuCode)

    if (!trimText(variant.variantName)) addError(`${prefix}.variantName`, 'Tên biến thể là bắt buộc.')

    const costPrice = Number(variant.costPrice || 0)
    if (!Number.isFinite(costPrice) || costPrice < 0) addError(`${prefix}.costPrice`, 'Giá vốn phải lớn hơn hoặc bằng 0.')
    const retailPrice = Number(variant.retailPrice || 0)
    if (!Number.isFinite(retailPrice) || retailPrice < 0) addError(`${prefix}.retailPrice`, 'Giá bán phải lớn hơn hoặc bằng 0.')
    if ((form.productType === 'THANH_PHAM' || variant.isSellable) && retailPrice <= 0) addError(`${prefix}.retailPrice`, 'Giá bán biến thể phải lớn hơn 0.')

    const minStock = Number(variant.minStock || 0)
    const maxStock = Number(variant.maxStock || 0)
    if (!Number.isFinite(minStock) || minStock < 0) addError(`${prefix}.minStock`, 'Tồn tối thiểu phải lớn hơn hoặc bằng 0.')
    if (!Number.isFinite(maxStock) || maxStock < 0) addError(`${prefix}.maxStock`, 'Tồn tối đa phải lớn hơn hoặc bằng 0.')
    if (Number.isFinite(minStock) && Number.isFinite(maxStock) && maxStock < minStock) addError(`${prefix}.maxStock`, 'Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.')

    const barcode = trimText(variant.barcode).toLowerCase()
    if (barcode) {
      if (variantBarcodes.has(barcode)) addError(`${prefix}.barcode`, 'Barcode SKU bị trùng.')
      else variantBarcodes.add(barcode)
    }

    variant.optionRows.forEach((option) => {
      const optionPrefix = `${prefix}.option.${option.key}`
      const optionName = trimText(option.name)
      const optionValue = trimText(option.value)
      if ((optionName && !optionValue) || (!optionName && optionValue)) {
        addError(`${optionPrefix}.name`, 'Thuộc tính cần đủ tên và giá trị.')
      }
    })

    if (form.productType === 'THANH_PHAM') {
      const usedMaterials = new Set()
      variant.bomLines.forEach((line) => {
        const linePrefix = `${prefix}.bom.${line.key}`
        if (!line.materialId) addError(`${linePrefix}.materialId`, 'BOM có dòng nguyên liệu chưa chọn.')
        else if (usedMaterials.has(String(line.materialId))) addError(`${linePrefix}.materialId`, 'Không được chọn trùng nguyên liệu trong cùng BOM.')
        else usedMaterials.add(String(line.materialId))

        const quantity = Number(line.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) addError(`${linePrefix}.quantity`, 'Số lượng BOM phải lớn hơn 0.')
      })
    }
  })

  return errors
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

function SectionCard({ title, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function SnapshotPreview({ product, categories, adminNotes, compact = false }) {
  const variants = product?.variants ?? []
  const units = product?.units ?? []
  const totalBomLines = variants.reduce((sum, variant) => sum + (variant.bomLines?.length ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <PreviewItem label="Sản phẩm" value={product?.name || '-'} />
        <PreviewItem label="Danh mục" value={getCategoryName(categories, product?.categoryId, product?.categoryName)} />
        <PreviewItem label="Loại hàng" value={getProductTypeLabel(product?.productType)} />
        <PreviewItem label="Đơn vị gốc" value={product?.baseUnit || '-'} />
      </div>

      {!compact ? (
        <div className="grid gap-3 md:grid-cols-3">
          <PreviewItem label="Khối lượng" value={product?.weightValue ? `${product.weightValue} ${product.weightUnit || ''}` : '-'} />
          <PreviewItem label="Xuất xứ" value={product?.origin || '-'} />
          <PreviewItem label="BOM" value={totalBomLines ? `${totalBomLines} dòng nguyên liệu` : 'Chưa có BOM'} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Tên biến thể</th>
              <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
              <th className="px-4 py-3 text-center font-semibold">BOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.length ? variants.map((variant, index) => (
              <tr key={`${variant.skuCode || index}`}>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">{variant.skuCode || '-'}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{variant.variantName || '-'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(variant.retailPrice)}</td>
                <td className="px-4 py-3 text-center">{variant.bomLines?.length ? `${variant.bomLines.length} dòng` : '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">Chưa có SKU.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Đơn vị bán</th>
                  <th className="px-4 py-3 text-right font-semibold">Tỷ lệ</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-3 text-center font-semibold">Loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit, index) => (
                  <tr key={`${unit.unitName}-${index}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{unit.unitName || '-'}</td>
                    <td className="px-4 py-3 text-right">{unit.conversionRate}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(unit.price)}</td>
                    <td className="px-4 py-3 text-center">{unit.isBaseUnit ? 'Đơn vị gốc' : unit.isDirectSell ? 'Bán trực tiếp' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <PreviewItem label="Hồ sơ hương vị" value={product?.flavorProfile || '-'} />
            <PreviewItem label="Hướng dẫn pha" value={product?.brewingGuide || '-'} />
            <PreviewItem label="Mô tả" value={product?.description || '-'} />
            <PreviewItem label="Ghi chú Admin" value={adminNotes || '-'} />
          </div>
        </>
      ) : null}
    </div>
  )
}

function PreviewItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function ConfirmModal({ product, categories, adminNotes, onClose, onConfirm, isSaving }) {
  if (!product) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Xác nhận tạo biên bản phê duyệt</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vui lòng kiểm tra thông tin sản phẩm, SKU và BOM trước khi tạo biên bản. Sau khi cấp mã, Thủ kho Kho tổng sẽ dùng mã này để tạo hàng hóa.
          </p>
        </header>
        <div className="max-h-[540px] overflow-y-auto px-6 py-5">
          <SnapshotPreview product={product} categories={categories} adminNotes={adminNotes} />
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Quay lại chỉnh sửa
          </button>
          <button type="button" onClick={onConfirm} disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
            {isSaving ? 'Đang tạo...' : 'Tạo biên bản'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function DetailModal({ item, categories, onClose, onAuthorize, onCancel, onCopy, isSaving }) {
  if (!item) return null
  const product = item.finalProductSnapshot || item.productSnapshot
  const creationMethodLabel = item.creationMethod === 'Manual'
    ? 'Nhập thủ công'
    : item.creationMethod === 'Automatic'
      ? 'Tự động từ biên bản'
      : '-'
  const createdSkuIds = Array.isArray(item.createdSkuIds) ? item.createdSkuIds : []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div className="flex max-h-[min(780px,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Chi tiết biên bản</h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono font-semibold text-[#356647]">{item.approvalCode}</span> - {statusLabel(item.status)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-4">
            <PreviewItem label="Mã biên bản" value={item.approvalCode || '-'} />
            <PreviewItem label="Mã phê duyệt" value={item.status === 'Draft' ? '-' : item.approvalCode || '-'} />
            <PreviewItem label="Trạng thái" value={statusLabel(item.status)} />
            <PreviewItem label="Phương thức tạo" value={creationMethodLabel} />
            <PreviewItem label="Người tạo" value={item.requestedByName || '-'} />
            <PreviewItem label="Thời gian tạo" value={formatDateTimeVN(item.requestedAt || item.createdAt)} />
            <PreviewItem label="Người cấp mã" value={item.authorisedByName || '-'} />
            <PreviewItem label="Cấp mã lúc" value={formatDateTimeVN(item.authorisedAt)} />
            <PreviewItem label="Người xác nhận" value={item.confirmedByName || '-'} />
            <PreviewItem label="Xác nhận lúc" value={formatDateTimeVN(item.confirmedAt)} />
            <PreviewItem label="Sản phẩm đã tạo" value={item.createdProductId || '-'} />
            <PreviewItem label="SKU đã tạo" value={createdSkuIds.length ? `${createdSkuIds.length} SKU` : '-'} />
          </div>
          {item.status === 'Cancelled' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <PreviewItem label="Lý do hủy" value={item.cancelReason || '-'} />
              <PreviewItem label="Người hủy" value={item.cancelledByName || '-'} />
              <PreviewItem label="Hủy lúc" value={formatDateTimeVN(item.cancelledAt)} />
            </div>
          ) : null}
          {item.creationMethod === 'Manual' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewItem label="Lý do nhập thủ công" value={item.manualModeReason || '-'} />
              <PreviewItem label="Ghi chú Kho tổng" value={item.warehouseNotes || '-'} />
            </div>
          ) : null}
          {product ? (
            <SnapshotPreview product={product} categories={categories} adminNotes={item.adminNotes} />
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Không đọc được snapshot sản phẩm.
            </p>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {item.status === 'Draft' ? (
            <button type="button" disabled={isSaving} onClick={() => onAuthorize(item)} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
              Cấp mã
            </button>
          ) : null}
          {item.status !== 'Draft' && item.approvalCode ? (
            <button type="button" onClick={() => onCopy(item.approvalCode)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sao chép mã
            </button>
          ) : null}
          {item.status !== 'Completed' && item.status !== 'Cancelled' ? (
            <button type="button" disabled={isSaving} onClick={() => onCancel(item)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              Hủy
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

export default function ProductApprovalsPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [existingSkus, setExistingSkus] = useState([])
  const [materialOptions, setMaterialOptions] = useState([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [isMaterialLoading, setIsMaterialLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(createInitialForm)
  const [errors, setErrors] = useState({})
  const [pendingProduct, setPendingProduct] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [categorySearch, setCategorySearch] = useState('')
  const [showCategoryOptions, setShowCategoryOptions] = useState(false)

  const existingSkuCodes = useMemo(
    () => new Set(existingSkus.map((sku) => normalizeSkuInput(sku.skuCode)).filter(Boolean)),
    [existingSkus],
  )

  const productSnapshot = useMemo(() => buildProductSnapshot(form, existingSkuCodes), [form, existingSkuCodes])

  const selectedCategory = useMemo(() => {
    const category = getCategoryById(categories, form.categoryId)
    if (!category) return null
    return {
      ...category,
      pathLabel: getCategoryPathLabel(categories, category.id, category.name),
    }
  }, [categories, form.categoryId])

  const activeCategoryOptions = useMemo(
    () => flattenCategoryTreeForSelect(
      categories.filter((item) => !item.isDeleted && item.isActive !== false),
    ),
    [categories],
  )

  const visibleCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase()
    return activeCategoryOptions.filter((item) => {
      if (!search) return true
      return item.name.toLowerCase().includes(search) || item.pathLabel.toLowerCase().includes(search)
    })
  }, [activeCategoryOptions, categorySearch])

  async function loadItems() {
    try {
      setIsLoading(true)
      const result = await fetchProductApprovals({ page: 1, pageSize: 50, status: 'all' })
      setItems(result.items)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
    fetchCategories({ isDeleted: false })
      .then(setCategories)
      .catch((error) => showError(error.message))
    fetchAllActiveSkus(100)
      .then(setExistingSkus)
      .catch(() => setExistingSkus([]))
  }, [])

  useEffect(() => {
    if (form.productType !== 'THANH_PHAM') {
      setMaterialOptions([])
      return
    }
    const timer = setTimeout(() => {
      setIsMaterialLoading(true)
      searchMaterials(materialSearch, 30)
        .then(setMaterialOptions)
        .catch(() => setMaterialOptions([]))
        .finally(() => setIsMaterialLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [materialSearch, form.productType])

  function updateFormField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'weightValue' || field === 'weightUnit') {
        next.variants = syncWeightOptionRows(
          prev.variants,
          field === 'weightValue' ? value : prev.weightValue,
          field === 'weightUnit' ? value : prev.weightUnit,
        )
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function selectCategory(category) {
    updateFormField('categoryId', String(category.id))
    setCategorySearch(category.pathLabel || getCategoryPathLabel(categories, category.id, category.name))
    setShowCategoryOptions(false)
  }

  function updateWeightValue(value) {
    const nextValue = String(value ?? '')
    if (nextValue && !/^\d+$/.test(nextValue)) {
      setErrors((prev) => ({ ...prev, weightValue: 'Khối lượng phải là số nguyên dương.' }))
      return
    }
    updateFormField('weightValue', nextValue)
  }

  function updateBaseUnit(value) {
    setForm((prev) => ({
      ...prev,
      baseUnit: value,
      units: prev.units.map((unit) => (unit.isBaseUnit ? { ...unit, unitName: value } : unit)),
      variants: prev.variants.map((variant) => ({
        ...variant,
        optionRows: variant.optionRows.map((option) => (
          option.name === 'Quy cách' ? { ...option, value } : option
        )),
      })),
    }))
  }

  function updateUnit(key, field, value) {
    setForm((prev) => ({
      ...prev,
      units: prev.units.map((unit) => {
        if (unit.key !== key) return field === 'isBaseUnit' && value ? { ...unit, isBaseUnit: false } : unit
        const next = { ...unit, [field]: value }
        if (field === 'isBaseUnit' && value) next.conversionRate = '1'
        return next
      }),
      variants: field === 'price' && getDefaultUnitPriceSource(prev.units)?.key === key
        ? prev.variants.map((variant) => (
          variant.retailPriceTouched ? variant : { ...variant, retailPrice: value }
        ))
        : prev.variants,
    }))
  }

  function addUnit() {
    setForm((prev) => ({ ...prev, units: [...prev.units, createUnit({ isBaseUnit: false, isDirectSell: true })] }))
  }

  function removeUnit(key) {
    setForm((prev) => {
      const units = prev.units.filter((unit) => unit.key !== key)
      return { ...prev, units: units.length ? units : prev.units }
    })
  }

  function updateVariant(key, field, value) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === key
          ? { ...variant, [field]: value, retailPriceTouched: field === 'retailPrice' ? true : variant.retailPriceTouched }
          : variant
      )),
    }))
  }

  function handleVariantImageChange(key, file) {
    if (!file) return
    if (!ALLOWED_VARIANT_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [`variant.${key}.imageUrl`]: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.' }))
      return
    }
    if (file.size > MAX_VARIANT_IMAGE_SIZE) {
      setErrors((prev) => ({ ...prev, [`variant.${key}.imageUrl`]: 'Ảnh biến thể tối đa 2MB.' }))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === key
          ? { ...variant, imagePreviewUrl: previewUrl, imageFileName: file.name, imageUrl: '' }
          : variant
      )),
    }))
    setErrors((prev) => ({ ...prev, [`variant.${key}.imageUrl`]: undefined }))
  }

  function removeVariantImage(key) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === key
          ? { ...variant, imagePreviewUrl: '', imageFileName: '', imageUrl: '' }
          : variant
      )),
    }))
  }

  function addVariant() {
    const unit = trimText(form.baseUnit) || 'gói'
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        createVariant({
          variantName: prev.name ? `${trimText(prev.name)} - ${unit}` : '',
          retailPrice: getDefaultSkuPrice(prev),
          optionRows: [createOptionRow({ name: 'Quy cách', value: unit })],
        }),
      ],
    }))
  }

  function syncVariantRetailPrice(key) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === key
          ? { ...variant, retailPrice: getDefaultSkuPrice(prev), retailPriceTouched: false }
          : variant
      )),
    }))
  }

  function removeVariant(key) {
    setForm((prev) => {
      const variants = prev.variants.filter((variant) => variant.key !== key)
      return { ...prev, variants: variants.length ? variants : prev.variants }
    })
  }

  function updateOption(variantKey, optionKey, field, value) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => {
        if (variant.key !== variantKey) return variant
        return {
          ...variant,
          optionRows: variant.optionRows.map((option) => (option.key === optionKey ? { ...option, [field]: value } : option)),
        }
      }),
    }))
  }

  function addOption(variantKey) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === variantKey
          ? { ...variant, optionRows: [...variant.optionRows, createOptionRow({ name: '', value: '' })] }
          : variant
      )),
    }))
  }

  function removeOption(variantKey, optionKey) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === variantKey
          ? { ...variant, optionRows: variant.optionRows.filter((option) => option.key !== optionKey) }
          : variant
      )),
    }))
  }

  function addBomLine(variantKey) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === variantKey ? { ...variant, bomLines: [...variant.bomLines, createBomLine()] } : variant
      )),
    }))
  }

  function updateBomLine(variantKey, lineKey, field, value) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => {
        if (variant.key !== variantKey) return variant
        return {
          ...variant,
          bomLines: variant.bomLines.map((line) => {
            if (line.key !== lineKey) return line
            if (field !== 'materialId') return { ...line, [field]: value }
            const material = materialOptions.find((item) => String(item.id) === String(value))
            return {
              ...line,
              materialId: value,
              materialName: material?.name || line.materialName,
              materialUnitName: getMaterialUnit(material) || line.materialUnitName,
            }
          }),
        }
      }),
    }))
  }

  function removeBomLine(variantKey, lineKey) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (
        variant.key === variantKey
          ? { ...variant, bomLines: variant.bomLines.filter((line) => line.key !== lineKey) }
          : variant
      )),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateApprovalForm(form, { existingSkuCodes, categories })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      showError('Vui lòng kiểm tra các trường còn thiếu hoặc chưa hợp lệ.')
      return
    }
    setPendingProduct(buildProductSnapshot(form, existingSkuCodes))
  }

  async function handleConfirmCreate() {
    if (!pendingProduct) return
    try {
      setIsSaving(true)
      const created = await createProductApprovalRequest({ product: pendingProduct, adminNotes: form.adminNotes })
      showSuccess(`Đã tạo biên bản ${created.approvalCode}.`)
      setPendingProduct(null)
      setForm(createInitialForm())
      setErrors({})
      setCategorySearch('')
      await loadItems()
    } catch (error) {
      showError(error.apiErrors?.length ? error.apiErrors.join(' ') : error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAuthorize(item) {
    try {
      setIsSaving(true)
      const updated = await authorizeProductApprovalRequest(item.id)
      showSuccess(`Đã cấp mã ${updated.approvalCode}.`)
      setDetailItem((current) => (current?.id === updated.id ? updated : current))
      await loadItems()
    } catch (error) {
      showError(error.apiErrors?.length ? error.apiErrors.join(' ') : error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancel(item) {
    const reason = window.prompt(`Lý do hủy biên bản ${item.approvalCode}?`)
    if (!reason?.trim()) return

    try {
      setIsSaving(true)
      await cancelProductApprovalRequest(item.id, reason)
      showSuccess('Đã hủy biên bản phê duyệt.')
      if (detailItem?.id === item.id) setDetailItem(null)
      await loadItems()
    } catch (error) {
      showError(error.apiErrors?.length ? error.apiErrors.join(' ') : error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopy(code) {
    try {
      await navigator.clipboard.writeText(code)
      showSuccess('Đã sao chép mã phê duyệt.')
    } catch {
      showError('Không thể sao chép mã. Vui lòng copy thủ công.')
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Duyệt sản phẩm mới</h1>
          <p className="mt-1 text-sm text-slate-500">
            Admin tạo biên bản, cấp mã, sau đó Thủ kho Kho tổng dùng mã tại trang tạo hàng hóa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <SectionCard title="1. Thông tin sản phẩm">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên sản phẩm *</span>
                <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.name} onChange={(event) => updateFormField('name', event.target.value)} />
                <FieldError message={errors.name} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Loại hàng *</span>
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.productType} onChange={(event) => updateFormField('productType', event.target.value)}>
                  {PRODUCT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <FieldError message={errors.productType} />
              </label>
              <div className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhóm hàng / Danh mục *</span>
                <div className="relative mt-1">
                  <input
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463] ${errors.categoryId ? 'border-rose-300 ring-2 ring-rose-100' : ''}`}
                    value={categorySearch || selectedCategory?.pathLabel || ''}
                    onFocus={() => setShowCategoryOptions(true)}
                    onBlur={() => setTimeout(() => setShowCategoryOptions(false), 120)}
                    onChange={(event) => {
                      const value = event.target.value
                      const exact = activeCategoryOptions.find((category) =>
                        !category.isDeleted
                        && category.isActive !== false
                        && (
                          category.name.toLowerCase() === value.trim().toLowerCase()
                          || category.pathLabel.toLowerCase() === value.trim().toLowerCase()
                        ),
                      )
                      setCategorySearch(value)
                      setShowCategoryOptions(true)
                      setForm((prev) => ({ ...prev, categoryId: exact ? String(exact.id) : '' }))
                      setErrors((prev) => ({ ...prev, categoryId: undefined }))
                    }}
                    placeholder="Tìm và chọn danh mục"
                  />
                  {showCategoryOptions ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {visibleCategories.length ? visibleCategories.slice(0, 12).map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCategory(category)}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f0eee6] ${String(category.id) === String(form.categoryId) ? 'bg-[#e8f1eb] font-semibold text-[#356647]' : 'text-slate-700'}`}
                        >
                          <span className="block font-medium">{category.selectLabel}</span>
                          {category.depth > 0 ? (
                            <span className="block text-xs text-slate-400">{category.pathLabel}</span>
                          ) : (
                            <span className="block text-xs text-slate-400">Danh mục cha</span>
                          )}
                        </button>
                      )) : (
                        <p className="px-3 py-3 text-sm text-slate-400">Không tìm thấy danh mục phù hợp.</p>
                      )}
                    </div>
                  ) : null}
                </div>
                <FieldError message={errors.categoryId} />
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Đơn vị gốc *</span>
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.baseUnit} onChange={(event) => updateBaseUnit(event.target.value)}>
                  {BASE_UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Đơn vị quản lý/bán chính của sản phẩm.</p>
                <FieldError message={errors.baseUnit} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Khối lượng</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                  value={form.weightValue}
                  onChange={(event) => updateWeightValue(event.target.value)}
                  placeholder="50"
                />
                <FieldError message={errors.weightValue} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Đơn vị khối lượng</span>
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.weightUnit} onChange={(event) => updateFormField('weightUnit', event.target.value)}>
                  {MEASUREMENT_UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Dùng cùng khối lượng để mô tả quy cách, ví dụ 50 g.</p>
                <FieldError message={errors.weightUnit} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Xuất xứ</span>
                <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.origin} onChange={(event) => updateFormField('origin', event.target.value)} />
              </label>
              <label className="block md:col-span-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hồ sơ hương vị</span>
                <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.flavorProfile} onChange={(event) => updateFormField('flavorProfile', event.target.value)} />
              </label>
              <label className="block md:col-span-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hướng dẫn pha</span>
                <textarea className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.brewingGuide} onChange={(event) => updateFormField('brewingGuide', event.target.value)} />
              </label>
              <label className="block md:col-span-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả</span>
                <textarea className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.description} onChange={(event) => updateFormField('description', event.target.value)} />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="2. Đơn vị bán" right={<button type="button" onClick={addUnit} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Thêm đơn vị</button>}>
            <FieldError message={errors.units} />
            <div className="space-y-3">
              {form.units.map((unit) => {
                const prefix = `unit.${unit.key}`
                return (
                  <div key={unit.key} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-6">
                    <label className="block md:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên đơn vị *</span>
                      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={unit.unitName} onChange={(event) => updateUnit(unit.key, 'unitName', event.target.value)} />
                      <FieldError message={errors[`${prefix}.unitName`]} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tỷ lệ *</span>
                      <input type="number" min="0" step="0.001" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={unit.conversionRate} onChange={(event) => updateUnit(unit.key, 'conversionRate', event.target.value)} disabled={unit.isBaseUnit} />
                      <FieldError message={errors[`${prefix}.conversionRate`]} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Giá bán</span>
                      <CurrencyInput
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                        value={unit.price}
                        onChange={(value) => updateUnit(unit.key, 'price', value)}
                      />
                      <FieldError message={errors[`${prefix}.price`]} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mã vạch</span>
                      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={unit.barcode} onChange={(event) => updateUnit(unit.key, 'barcode', event.target.value)} />
                      <FieldError message={errors[`${prefix}.barcode`]} />
                    </label>
                    <div className="flex items-end justify-between gap-2">
                      <div className="space-y-2 pb-1 text-xs font-semibold text-slate-600">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={unit.isDirectSell} onChange={(event) => updateUnit(unit.key, 'isDirectSell', event.target.checked)} /> Bán trực tiếp</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={unit.isBaseUnit} onChange={(event) => updateUnit(unit.key, 'isBaseUnit', event.target.checked)} /> Đơn vị gốc</label>
                      </div>
                      {form.units.length > 1 ? (
                        <button type="button" onClick={() => removeUnit(unit.key)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Xóa</button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="3. SKU / Biến thể" right={<button type="button" onClick={addVariant} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Thêm SKU</button>}>
            <FieldError message={errors.variants} />
            <p className="mb-3 text-xs text-slate-500">
              Giá bán SKU mặc định lấy theo giá bán đơn vị bán. Nếu chỉnh riêng, hệ thống sẽ giữ giá riêng cho SKU đó.
            </p>
            <div className="space-y-4">
              {form.variants.map((variant, index) => {
                const prefix = `variant.${variant.key}`
                const skuPreview = previewSkuForVariant(form, variant.key, existingSkuCodes)
                return (
                  <div key={variant.key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-800">SKU #{index + 1}</h3>
                      {form.variants.length > 1 ? (
                        <button type="button" onClick={() => removeVariant(variant.key)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">Xóa SKU</button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mã SKU</span>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#538463] disabled:bg-slate-100 disabled:text-slate-500"
                          value={variant.autoSku ? skuPreview : variant.skuCode}
                          onChange={(event) => updateVariant(variant.key, 'skuCode', normalizeSkuInput(event.target.value))}
                          placeholder="FG-TRA-SEN-50G"
                          disabled={variant.autoSku}
                        />
                        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input type="checkbox" checked={variant.autoSku} onChange={(event) => updateVariant(variant.key, 'autoSku', event.target.checked)} />
                          Tự động sinh mã SKU
                        </label>
                        <FieldError message={errors[`${prefix}.skuCode`]} />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên biến thể *</span>
                        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={variant.variantName} onChange={(event) => updateVariant(variant.key, 'variantName', event.target.value)} placeholder="Trà Sen - gói 50g" />
                        <FieldError message={errors[`${prefix}.variantName`]} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Barcode</span>
                        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={variant.barcode} onChange={(event) => updateVariant(variant.key, 'barcode', event.target.value)} />
                        <FieldError message={errors[`${prefix}.barcode`]} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Giá vốn</span>
                        <CurrencyInput
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                          value={variant.costPrice}
                          onChange={(value) => updateVariant(variant.key, 'costPrice', value)}
                        />
                        <FieldError message={errors[`${prefix}.costPrice`]} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Giá bán</span>
                        <CurrencyInput
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                          value={variant.retailPrice}
                          onChange={(value) => updateVariant(variant.key, 'retailPrice', value)}
                        />
                        {variant.retailPriceTouched ? (
                          <button type="button" onClick={() => syncVariantRetailPrice(variant.key)} className="mt-1 text-xs font-bold text-[#356647] hover:underline">
                            Đồng bộ theo giá đơn vị bán
                          </button>
                        ) : null}
                        <FieldError message={errors[`${prefix}.retailPrice`]} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tồn tối thiểu</span>
                        <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={variant.minStock} onChange={(event) => updateVariant(variant.key, 'minStock', event.target.value)} />
                        <FieldError message={errors[`${prefix}.minStock`]} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tồn tối đa</span>
                        <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={variant.maxStock} onChange={(event) => updateVariant(variant.key, 'maxStock', event.target.value)} />
                        <FieldError message={errors[`${prefix}.maxStock`]} />
                      </label>
                      <div className="block md:col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh biến thể</span>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          {variant.imagePreviewUrl ? (
                            <img src={variant.imagePreviewUrl} alt={variant.imageFileName || 'Ảnh biến thể'} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">Ảnh</div>
                          )}
                          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            Chọn ảnh
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(event) => {
                                handleVariantImageChange(variant.key, event.target.files?.[0])
                                event.target.value = ''
                              }}
                            />
                          </label>
                          {variant.imagePreviewUrl ? (
                            <button type="button" onClick={() => removeVariantImage(variant.key)} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                              Xóa ảnh
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Ảnh được preview trên form. Hệ thống chưa lưu ảnh local nếu chưa có API upload.</p>
                        <FieldError message={errors[`${prefix}.imageUrl`]} />
                      </div>
                      <div className="flex flex-wrap items-end gap-4 text-xs font-semibold text-slate-600 md:col-span-2">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={variant.isSellable} onChange={(event) => updateVariant(variant.key, 'isSellable', event.target.checked)} /> Có bán</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={variant.allowRewardPoints} onChange={(event) => updateVariant(variant.key, 'allowRewardPoints', event.target.checked)} /> Tích điểm</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(variant.key, 'isActive', event.target.checked)} /> Hoạt động</label>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thuộc tính biến thể</p>
                          <p className="mt-1 text-xs text-slate-400">Dùng để phân biệt các SKU, ví dụ Quy cách = gói, Khối lượng = 50g.</p>
                        </div>
                        <button type="button" onClick={() => addOption(variant.key)} className="text-xs font-bold text-[#356647]">Thêm thuộc tính</button>
                      </div>
                      <div className="space-y-2">
                        {variant.optionRows.map((option) => {
                          const optionPrefix = `${prefix}.option.${option.key}`
                          return (
                            <div key={option.key} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                              <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={option.name} onChange={(event) => updateOption(variant.key, option.key, 'name', event.target.value)} placeholder="Quy cách" />
                              <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={option.value} onChange={(event) => updateOption(variant.key, option.key, 'value', event.target.value)} placeholder="gói / 50g" />
                              <button type="button" onClick={() => removeOption(variant.key, option.key)} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">Xóa</button>
                              <FieldError message={errors[`${optionPrefix}.name`]} />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {form.productType === 'THANH_PHAM' ? (
                      <div className="mt-4 rounded-xl border border-slate-200 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">BOM nguyên liệu</p>
                            {!variant.bomLines.length ? <p className="mt-1 text-xs text-amber-600">Thành phẩm chưa có BOM. Vẫn có thể tạo biên bản nếu sản phẩm chưa cần định mức.</p> : null}
                          </div>
                          <div className="flex gap-2">
                            <input className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Tìm nguyên liệu" />
                            <button type="button" onClick={() => addBomLine(variant.key)} className="rounded-lg bg-[#538463] px-3 py-2 text-xs font-bold text-white hover:bg-[#457053]">Thêm BOM</button>
                          </div>
                        </div>
                        {variant.bomLines.length ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">Nguyên liệu</th>
                                  <th className="px-3 py-2 text-center font-semibold">Số lượng</th>
                                  <th className="px-3 py-2 font-semibold">Đơn vị</th>
                                  <th className="px-3 py-2 text-right font-semibold">Hành động</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {variant.bomLines.map((line) => {
                                  const linePrefix = `${prefix}.bom.${line.key}`
                                  const selectedMissing = line.materialId && !materialOptions.some((material) => String(material.id) === String(line.materialId))
                                  return (
                                    <tr key={line.key}>
                                      <td className="px-3 py-2">
                                        <select className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]" value={line.materialId} onChange={(event) => updateBomLine(variant.key, line.key, 'materialId', event.target.value)}>
                                          <option value="">Chọn nguyên liệu</option>
                                          {selectedMissing ? <option value={line.materialId}>{line.materialName || line.materialId}</option> : null}
                                          {materialOptions.map((material) => (
                                            <option key={material.id} value={material.id}>{material.name}</option>
                                          ))}
                                        </select>
                                        <FieldError message={errors[`${linePrefix}.materialId`]} />
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <input type="number" min="0" step="0.001" className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm outline-none focus:border-[#538463]" value={line.quantity} onChange={(event) => updateBomLine(variant.key, line.key, 'quantity', event.target.value)} />
                                        <FieldError message={errors[`${linePrefix}.quantity`]} />
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">{line.materialUnitName || '-'}</td>
                                      <td className="px-3 py-2 text-right">
                                        <button type="button" onClick={() => removeBomLine(variant.key, line.key)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Xóa</button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {isMaterialLoading ? <p className="mt-2 text-xs text-slate-400">Đang tải nguyên liệu...</p> : null}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        BOM không áp dụng cho nguyên liệu.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="4. Ghi chú Admin">
            <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.adminNotes} onChange={(event) => updateFormField('adminNotes', event.target.value)} placeholder="Ghi chú nội bộ cho biên bản phê duyệt" />
            <FieldError message={errors.adminNotes} />
          </SectionCard>

          <SectionCard title="5. Xem trước biên bản">
            <SnapshotPreview product={productSnapshot} categories={categories} adminNotes={form.adminNotes} />
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={isSaving} className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
                Tạo biên bản
              </button>
            </div>
          </SectionCard>
        </form>

        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Danh sách biên bản</h2>
            <button type="button" onClick={loadItems} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Làm mới
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã biên bản</th>
                  <th className="px-4 py-3 font-semibold">Tên sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">Loại hàng</th>
                  <th className="px-4 py-3 font-semibold">Nhóm hàng / Danh mục</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Mã phê duyệt</th>
                  <th className="px-4 py-3 font-semibold">Người tạo</th>
                  <th className="px-4 py-3 font-semibold">Thời gian tạo</th>
                  <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Đang tải...</td>
                  </tr>
                ) : items.length ? items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">{item.approvalCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.productName || item.productSnapshot?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={productTypeTone(item.productType || item.productSnapshot?.productType)}>
                        {getProductTypeLabel(item.productType || item.productSnapshot?.productType)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{getCategoryName(categories, item.categoryId || item.productSnapshot?.categoryId, item.productSnapshot?.categoryName)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{item.status === 'Draft' ? '-' : item.approvalCode}</td>
                    <td className="px-4 py-3 text-slate-600">{item.requestedByName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTimeVN(item.requestedAt || item.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setDetailItem(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Xem chi tiết</button>
                        {item.status === 'Draft' ? (
                          <button type="button" disabled={isSaving} onClick={() => handleAuthorize(item)} className="rounded-lg bg-[#538463] px-3 py-2 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50">Cấp mã</button>
                        ) : null}
                        {item.status !== 'Draft' && item.approvalCode ? (
                          <button type="button" onClick={() => handleCopy(item.approvalCode)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Sao chép mã</button>
                        ) : null}
                        {item.status !== 'Completed' && item.status !== 'Cancelled' ? (
                          <button type="button" disabled={isSaving} onClick={() => handleCancel(item)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Hủy</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Chưa có biên bản phê duyệt.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmModal
        product={pendingProduct}
        categories={categories}
        adminNotes={form.adminNotes}
        isSaving={isSaving}
        onClose={() => setPendingProduct(null)}
        onConfirm={handleConfirmCreate}
      />
      <DetailModal
        item={detailItem}
        categories={categories}
        isSaving={isSaving}
        onClose={() => setDetailItem(null)}
        onAuthorize={handleAuthorize}
        onCancel={handleCancel}
        onCopy={handleCopy}
      />
    </PageShell>
  )
}
