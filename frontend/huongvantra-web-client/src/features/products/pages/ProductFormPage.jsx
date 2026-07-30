import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canAdjustStoreStock, canCreateCatalog } from '../../auth/utils/permissions.js'
import ProductBomConfigModal from '../components/ProductBomConfigModal.jsx'
import ProductSkusPanel from '../components/ProductSkusPanel.jsx'
import ProductVariantsPanel from '../components/ProductVariantsPanel.jsx'
import { createCategory, fetchCategories } from '../services/categoriesApi.js'
import { createBrand, fetchBrands } from '../services/brandsApi.js'
import { createAttributeName, fetchAttributeNames } from '../services/attributeNamesApi.js'
import {
  createProductFromApproval,
  createProductManualFromApproval,
  fetchProductApprovals,
  fetchProductById,
  updateProduct,
  validateProductApprovalCode,
} from '../services/productsApi.js'
import { mapProductApiError, validateProductForm } from '../utils/productValidation.js'
import { setProductListFocus } from '../utils/productListFocus.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'
import {
  flattenCategoryTreeForSelect,
  getCategoryPathLabel,
  isCategoryUnavailable,
} from '../utils/categoryTreeUtils.js'

const PRODUCT_TYPES = { NGUYEN_LIEU: 'NGUYEN_LIEU', THANH_PHAM: 'THANH_PHAM' }

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ATTRIBUTE_OPTIONS = ['Màu sắc', 'Kích cỡ', 'Dung tích', 'Vị', 'Chất liệu']

const EMPTY_UNIT = {
  id: '',
  unitName: 'cái',
  conversionRate: '1',
  price: '0',
  barcode: '',
  isDirectSell: true,
  isBaseUnit: true,
}

const EMPTY_ATTRIBUTE = {
  id: '',
  name: '',
  inputValue: '',
  values: [],
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

function hasCloudinaryUploadConfig() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
}

async function uploadImageToCloudinary(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Không upload được ảnh lên Cloudinary.')
  }

  const data = await response.json()
  const imageUrl = data.secure_url || data.url
  if (!imageUrl) {
    throw new Error('Cloudinary không trả về đường dẫn ảnh.')
  }

  return imageUrl
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatCurrency(value) {
  return toNumber(value).toLocaleString('vi-VN')
}

function CurrencyInput({ value, onChange, disabled, className, placeholder = '0' }) {
  const num = parseInt(String(value ?? '').replace(/\D/g, '') || '0', 10)
  const display = Number.isFinite(num) && num !== 0 ? num.toLocaleString('vi-VN') : ''

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '')
        onChange?.(digits || '0')
      }}
    />
  )
}

function cartesianProduct(groups) {
  if (!groups.length) return [[]]
  return groups.reduce(
    (rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { name: group.name, value }])),
    [[]],
  )
}

function buildVariantKey(unit, attributes) {
  const attributeKey = attributes.map((item) => `${item.name}:${item.value}`).join('|')
  return `${unit.id || unit.unitName}__${attributeKey || 'default'}`
}

function normalizeText(value) {
  return String(value || '').trim()
}

// Replicate backend BuildSkuPrefix: remove Vietnamese diacritics, uppercase, hyphenate, max 20 chars
function buildSkuPrefix(text) {
  return String(text || '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
    .replace(/-+$/, '')
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-[#b42318]">{message}</p>
}

// Modal for creating a category
function CreateCategoryModal({ isOpen, onClose, categories, onCreated }) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setParentId('')
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      setSaving(true)
      const created = await createCategory({ name: name.trim(), parentId: parentId || null })
      onCreated?.(created)
      onClose()
    } catch (err) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const treeOptions = flattenCategoryTreeForSelect(
    categories.filter((c) => !c.isDeleted && c.isActive !== false),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">Tạo nhóm hàng mới</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên nhóm *</span>
            <input
              ref={nameRef}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
              placeholder="VD: Trà, Cà phê, Bánh..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhóm cha (tuỳ chọn)</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Không có — tạo nhóm gốc</option>
              {treeOptions.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.pathLabel}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Nếu không chọn nhóm cha, nhóm này sẽ là nhóm gốc.</p>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Huỷ
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
              {saving ? 'Đang tạo...' : 'Tạo nhóm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal for creating a brand (stored client-side only, no backend yet)
function CreateBrandModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      setSaving(true)
      const created = await createBrand(name.trim())
      onCreated?.(created)
      onClose()
    } catch (err) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">Tạo thương hiệu mới</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên thương hiệu *</span>
            <input
              ref={nameRef}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
              placeholder="VD: Hương Vân Trà, OEM..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Huỷ
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
              {saving ? 'Đang tạo...' : 'Tạo thương hiệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateAttributeNameModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      setSaving(true)
      const created = await createAttributeName(name.trim())
      onCreated?.(created)
      onClose()
    } catch (err) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">Tạo tên thuộc tính</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên thuộc tính *</span>
            <input
              ref={nameRef}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
              placeholder="VD: Hương vị, Đóng gói, Độ tuổi..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Huỷ</button>
          <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">{saving ? 'Đang tạo...' : 'Tạo thuộc tính'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function getProductTypeLabel(value) {
  return value === PRODUCT_TYPES.NGUYEN_LIEU ? 'Nguyên liệu / Bao bì' : 'Thành phẩm kinh doanh'
}

const APPROVAL_CATEGORY_UNAVAILABLE_MESSAGE = 'Danh mục trong biên bản không còn tồn tại hoặc đã bị vô hiệu hóa.'

function parseOptionValuesJson(value) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeComparableText(value) {
  return String(value ?? '').trim()
}

function normalizeComparableSku(value) {
  return normalizeComparableText(value).toUpperCase()
}

function normalizeComparableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(3)) : null
}

function canonicalApprovalProduct(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const units = Array.isArray(product?.units) ? product.units : []
  return {
    name: normalizeComparableText(product?.name),
    productType: normalizeComparableText(product?.productType),
    categoryId: Number(product?.categoryId || 0),
    baseUnit: normalizeComparableText(product?.baseUnit),
    weightValue: normalizeComparableNumber(product?.weightValue),
    weightUnit: normalizeComparableText(product?.weightUnit),
    units: units
      .map((unit) => ({
        unitName: normalizeComparableText(unit.unitName).toLowerCase(),
        conversionRate: normalizeComparableNumber(unit.conversionRate),
        price: normalizeComparableNumber(unit.price),
        isDirectSell: unit.isDirectSell !== false,
        isBaseUnit: Boolean(unit.isBaseUnit),
      }))
      .sort((a, b) => a.unitName.localeCompare(b.unitName)),
    variants: variants
      .map((variant) => ({
        skuCode: normalizeComparableSku(variant.skuCode),
        variantName: normalizeComparableText(variant.variantName),
        costPrice: normalizeComparableNumber(variant.costPrice),
        retailPrice: normalizeComparableNumber(variant.retailPrice),
        minStock: normalizeComparableNumber(variant.minStock),
        maxStock: normalizeComparableNumber(variant.maxStock),
        bomLines: (Array.isArray(variant.bomLines) ? variant.bomLines : [])
          .map((line) => ({
            materialId: normalizeComparableText(line.materialId ?? line.MaterialId),
            quantity: normalizeComparableNumber(line.quantity ?? line.Quantity),
          }))
          .sort((a, b) => a.materialId.localeCompare(b.materialId)),
      }))
      .sort((a, b) => a.skuCode.localeCompare(b.skuCode)),
  }
}

function compareApprovalProducts(approved, manual) {
  const left = canonicalApprovalProduct(approved)
  const right = canonicalApprovalProduct(manual)
  const diffs = []
  if (left.name !== right.name) diffs.push('Tên sản phẩm khác')
  if (left.productType !== right.productType) diffs.push('Loại hàng khác')
  if (left.categoryId !== right.categoryId) diffs.push('Danh mục khác')
  if (left.baseUnit !== right.baseUnit) diffs.push('Đơn vị gốc khác')
  if (left.weightValue !== right.weightValue || left.weightUnit !== right.weightUnit) diffs.push('Khối lượng/quy cách khác')
  if (JSON.stringify(left.units) !== JSON.stringify(right.units)) diffs.push('Đơn vị bán khác')
  if (left.variants.length !== right.variants.length) {
    diffs.push('Số lượng SKU khác')
  } else {
    const rightBySku = new Map(right.variants.map((variant) => [variant.skuCode, variant]))
    for (const approvedVariant of left.variants) {
      const manualVariant = rightBySku.get(approvedVariant.skuCode)
      if (!manualVariant) {
        diffs.push(`SKU ${approvedVariant.skuCode || '(trống)'} khác`)
        continue
      }
      if (approvedVariant.variantName !== manualVariant.variantName) diffs.push(`Tên biến thể ${approvedVariant.skuCode} khác`)
      if (approvedVariant.costPrice !== manualVariant.costPrice) diffs.push(`Giá vốn ${approvedVariant.skuCode} khác`)
      if (approvedVariant.retailPrice !== manualVariant.retailPrice) diffs.push(`Giá bán ${approvedVariant.skuCode} khác`)
      if (approvedVariant.minStock !== manualVariant.minStock || approvedVariant.maxStock !== manualVariant.maxStock) diffs.push(`Tồn min/max ${approvedVariant.skuCode} khác`)
      if (JSON.stringify(approvedVariant.bomLines) !== JSON.stringify(manualVariant.bomLines)) diffs.push(`BOM ${approvedVariant.skuCode} khác`)
    }
  }
  return Array.from(new Set(diffs))
}

function ApprovalProductPreview({ product, categories = [] }) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const units = Array.isArray(product?.units) ? product.units : []

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-slate-100 bg-[#fbf9f1] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên hàng</p>
          <p className="mt-1 font-semibold text-slate-800">{product?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Loại hàng</p>
          <p className="mt-1 font-semibold text-slate-800">{getProductTypeLabel(product?.productType)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhóm hàng</p>
          <p className="mt-1 font-semibold text-slate-800">{getCategoryPathLabel(categories, product?.categoryId, product?.categoryName)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đơn vị gốc</p>
          <p className="mt-1 font-semibold text-slate-800">{product?.baseUnit || units.find((u) => u.isBaseUnit)?.unitName || '—'}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Tên biến thể</th>
              <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
              <th className="px-4 py-3 text-center font-semibold">BOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.length ? variants.map((variant, index) => {
              const bomLines = Array.isArray(variant.bomLines) ? variant.bomLines : []
              return (
                <tr key={`${variant.skuCode || index}-${index}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">{variant.skuCode || 'Tự sinh'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{variant.variantName || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(variant.retailPrice)} đ</td>
                  <td className="px-4 py-3 text-center text-slate-600">{bomLines.length ? `${bomLines.length} dòng` : '—'}</td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có SKU trong snapshot.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ApprovalCodeGate({ approvalCode, onCodeChange, onValidate, isLoading, pendingApprovals = [], categories = [] }) {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-[1rem] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined rounded-xl bg-[#e8f1eb] p-2 text-[#356647]">verified</span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Tạo hàng hóa mới</h1>
              <p className="mt-1 text-sm text-slate-500">Sản phẩm mới cần mã xác nhận do Admin cấp.</p>
            </div>
          </div>

          <form onSubmit={onValidate} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mã phê duyệt</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm uppercase outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
                placeholder="NPA-YYYYMMDD-XXXXXX"
                value={approvalCode}
                onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading || !approvalCode.trim()}
                className="w-full rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50"
              >
                {isLoading ? 'Đang kiểm tra...' : 'Kiểm tra mã'}
              </button>
            </div>
          </form>

          <Link to="/inventory/products" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-[#356647]">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách
          </Link>
        </div>

        {pendingApprovals.length ? (
          <section className="rounded-[1rem] bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-800">Biên bản chờ tạo hàng hóa</h2>
            <div className="mt-4 space-y-3">
              {pendingApprovals.map((approval) => (
                <button
                  key={approval.id}
                  type="button"
                  onClick={() => onCodeChange(approval.approvalCode)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-[#538463] hover:bg-[#f7fbf8]"
                >
                  <span className="font-mono text-xs font-bold text-[#356647]">{approval.approvalCode}</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-800">{approval.productName || approval.productSnapshot?.name || '—'}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {getCategoryPathLabel(categories, approval.categoryId || approval.productSnapshot?.categoryId, approval.productSnapshot?.categoryName)}
                    {' · '}
                    Cấp mã lúc {formatDateTimeVN(approval.authorisedAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  )
}

function ApprovalModeSelection({ approval, categories = [], onSelectMode, onReset }) {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Mã phê duyệt hợp lệ</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mã <span className="font-mono font-semibold text-[#356647]">{approval.approvalCode}</span> đang chờ Thủ kho Kho tổng xác nhận tạo hàng hóa.
            </p>
          </div>
          <button type="button" onClick={onReset} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Đổi mã
          </button>
        </div>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
          <ApprovalProductPreview product={approval.productSnapshot} categories={categories} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectMode('automatic')}
            className="rounded-[1rem] border border-[#356647]/30 bg-white p-5 text-left shadow-sm hover:border-[#356647] hover:bg-[#f7fbf8]"
          >
            <span className="material-symbols-outlined text-[#356647]">auto_awesome</span>
            <span className="mt-3 block text-base font-bold text-slate-800">Tạo tự động từ biên bản</span>
            <span className="mt-1 block text-sm text-slate-500">Dùng đúng snapshot Product/SKU/BOM đã được Admin phê duyệt.</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('manual')}
            className="rounded-[1rem] border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-[#356647] hover:bg-[#f7fbf8]"
          >
            <span className="material-symbols-outlined text-[#356647]">edit_document</span>
            <span className="mt-3 block text-base font-bold text-slate-800">Nhập thủ công</span>
            <span className="mt-1 block text-sm text-slate-500">Chỉ dùng khi cần nhập lại theo biên bản đã được cấp mã.</span>
          </button>
        </section>
      </div>
    </PageShell>
  )
}

function AutomaticApprovalCreatePage({ approval, categories = [], onCreate, onBack, isSaving }) {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Tạo tự động từ biên bản</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mã phê duyệt: <span className="font-mono font-semibold text-[#356647]">{approval.approvalCode}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Chọn lại
            </button>
            <button type="button" onClick={onCreate} disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50">
              {isSaving ? 'Đang tạo...' : 'Xác nhận tạo hàng hóa'}
            </button>
          </div>
        </div>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 rounded-xl border border-[#356647]/20 bg-[#f7fbf8] p-4 text-sm text-slate-600">
            Hệ thống sẽ tạo hàng hóa đúng theo thông tin Product/SKU/BOM đã được Admin cấp mã. Thủ kho chỉ xác nhận tạo, không chỉnh sửa dữ liệu trong chế độ tự động.
          </div>
          <ApprovalProductPreview product={approval.productSnapshot} categories={categories} />
        </section>
      </div>
    </PageShell>
  )
}

function ManualCreationConfirmModal({ payload, approval, reason, categories = [], onClose, onConfirm, isSaving }) {
  if (!payload) return null
  const variants = Array.isArray(payload.variants) ? payload.variants : []
  const totalBomLines = variants.reduce((sum, variant) => sum + (Array.isArray(variant.bomLines) ? variant.bomLines.length : 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Xác nhận tạo hàng hóa thủ công</h2>
            <p className="mt-1 text-sm text-slate-500">Mã phê duyệt: <span className="font-mono font-semibold text-[#356647]">{approval?.approvalCode}</span></p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="max-h-[calc(100dvh-220px)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 rounded-xl border border-slate-100 bg-[#fbf9f1] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên hàng</p>
              <p className="mt-1 font-semibold text-slate-800">{payload.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Loại hàng</p>
              <p className="mt-1 font-semibold text-slate-800">{getProductTypeLabel(payload.productType)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhóm hàng</p>
              <p className="mt-1 font-semibold text-slate-800">{getCategoryPathLabel(categories, payload.categoryId, payload.categoryName)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SKU</p>
              <p className="mt-1 font-semibold text-slate-800">{variants.length}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">BOM</p>
              <p className="mt-1 font-semibold text-slate-800">{totalBomLines} dòng</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Tên biến thể</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-3 text-center font-semibold">BOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((variant, index) => (
                  <tr key={`${variant.skuCode || index}-${index}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">{variant.skuCode || 'Tự sinh'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{variant.variantName || '—'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(variant.retailPrice)} đ</td>
                    <td className="px-4 py-3 text-center">{variant.bomLines?.length ? `${variant.bomLines.length} dòng` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Lý do nhập thủ công</p>
            <p className="mt-1 whitespace-pre-wrap">{reason}</p>
          </div>
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            Tôi xác nhận thông tin nhập thủ công khớp với biên bản đã được duyệt.
          </p>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Quay lại sửa
          </button>
          <button type="button" onClick={onConfirm} disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
            {isSaving ? 'Đang tạo...' : 'Xác nhận tạo hàng hóa'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function ProductFormPage({ mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = mode === 'edit' || Boolean(id)
  const [session, setSession] = useState(() => loadAuthSession())
  const canEdit = canCreateCatalog(session)
  const canAdjustStock = canAdjustStoreStock(session)
  const stockOnlyAccess = isEditMode && !canEdit && canAdjustStock

  const [categories, setCategories] = useState([])
  const [dbBrands, setDbBrands] = useState([])
  const [dbAttributeNames, setDbAttributeNames] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [variantDrafts, setVariantDrafts] = useState({})
  const [productType, setProductType] = useState(PRODUCT_TYPES.THANH_PHAM)
  const [productVariants, setProductVariants] = useState([])
  const [bomByVariant, setBomByVariant] = useState({})
  const [bomModalVariant, setBomModalVariant] = useState(null)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [customAttrNames, setCustomAttrNames] = useState([])
  const [addAttrNameModal, setAddAttrNameModal] = useState({ open: false, forIndex: null })
  const [duplicateProductName, setDuplicateProductName] = useState('')
  const [approvalCode, setApprovalCode] = useState('')
  const [approvalRecord, setApprovalRecord] = useState(null)
  const [approvalMode, setApprovalMode] = useState('')
  const [isApprovalLoading, setIsApprovalLoading] = useState(false)
  const [isAutomaticCreating, setIsAutomaticCreating] = useState(false)
  const [manualModeReason, setManualModeReason] = useState('')
  const [pendingManualPayload, setPendingManualPayload] = useState(null)
  const [pendingApprovals, setPendingApprovals] = useState([])
  const isFinishedProduct = productType === PRODUCT_TYPES.THANH_PHAM

  const [form, setForm] = useState(() => ({
    productCode: '',
    barcode: '',
    name: '',
    categoryId: '',
    brandId: '',
    brandName: '',
    origin: '',
    flavorProfile: '',
    brewingGuide: '',
    description: '',
    costPrice: '0',
    salePrice: '0',
    stockQuantity: '0',
    minStock: '0',
    maxStock: '999999999',
    weightValue: '',
    weightUnit: 'g',
    images: [],
    units: [{ ...EMPTY_UNIT, id: createLocalId('unit') }],
    attributes: [{ ...EMPTY_ATTRIBUTE, id: createLocalId('attr') }],
    isActive: true,
    isPurchasable: true,
  }))

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadCategories() {
      try {
        const items = await fetchCategories({ isDeleted: false })
        if (mounted) setCategories(items)
      } catch (error) {
        if (mounted) showError(error.message)
      }
    }
    loadCategories()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!isEditMode && !canEdit) {
      navigate('/inventory/products', { replace: true })
      return
    }
    if (isEditMode && !canEdit && !canAdjustStock) {
      navigate('/inventory/products', { replace: true })
    }
  }, [canEdit, canAdjustStock, isEditMode, navigate])

  useEffect(() => {
    let mounted = true
    fetchBrands().then((list) => { if (mounted) setDbBrands(list) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    fetchAttributeNames().then((list) => { if (mounted) setDbAttributeNames(list) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (isEditMode || !canEdit) return undefined
    let mounted = true
    fetchProductApprovals({ status: 'AwaitingWarehouseConfirmation', page: 1, pageSize: 8 })
      .then((result) => {
        if (mounted) setPendingApprovals(result.items || [])
      })
      .catch(() => {
        if (mounted) setPendingApprovals([])
      })
    return () => { mounted = false }
  }, [canEdit, isEditMode])

  useEffect(() => {
    if (!isEditMode || !id) return undefined
    let mounted = true
    async function loadProduct() {
      try {
        setIsLoading(true)
        const product = await fetchProductById(id)
        if (!mounted) return
        const baseUnit = product.units?.find((unit) => unit.isBaseUnit) || product.units?.[0]
        const mappedUnits = product.units?.length
          ? product.units.map((unit, index) => ({
              id: unit.id || createLocalId('unit'),
              unitName: unit.unitName || (index === 0 ? product.baseUnit : ''),
              conversionRate: String(unit.conversionRate || 1),
              price: String(unit.price ?? 0),
              barcode: unit.barcode || '',
              isDirectSell: unit.isDirectSell !== false,
              isBaseUnit: Boolean(unit.isBaseUnit || index === 0),
            }))
          : [{ ...EMPTY_UNIT, id: createLocalId('unit'), unitName: product.baseUnit || 'cái' }]

        setForm((prev) => ({
          ...prev,
          name: product.name || '',
          categoryId: product.categoryId ? String(product.categoryId) : '',
          origin: product.origin || '',
          flavorProfile: product.flavorProfile || '',
          brewingGuide: product.brewingGuide || '',
          description: product.description || '',
          salePrice: String(baseUnit?.price ?? product.variants?.[0]?.retailPrice ?? product.skus?.[0]?.retailPrice ?? product.skus?.[0]?.basePrice ?? 0),
          costPrice: String(product.variants?.[0]?.costPrice ?? product.skus?.[0]?.costPrice ?? 0),
          minStock: String(product.variants?.[0]?.minStock ?? product.skus?.[0]?.minStock ?? 0),
          maxStock: String(product.variants?.[0]?.maxStock ?? product.skus?.[0]?.maxStock ?? 999999999),
          weightValue: product.weightValue ?? '',
          weightUnit: product.weightUnit || 'g',
          images: product.images?.map((image) => ({
            id: image.id || createLocalId('image'),
            imageUrl: image.imageUrl || '',
            previewUrl: image.imageUrl || '',
            name: image.altText || image.imageUrl || 'Ảnh sản phẩm',
            sortOrder: image.sortOrder || 0,
            isThumbnail: image.isThumbnail,
          })) ?? [],
          units: mappedUnits,
          isPurchasable: product.variants?.[0]?.isPurchasable !== false,
        }))
        setProductType(product.productType || PRODUCT_TYPES.THANH_PHAM)
        setProductVariants(product.variants ?? [])
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadProduct()
    return () => { mounted = false }
  }, [id, isEditMode])

  // Flat tree list for the category select (shows hierarchy via indentation)
  const categoryTreeOptions = useMemo(() => {
    const visible = categories.filter(
      (c) => (!c.isDeleted && c.isActive !== false) || String(c.id) === String(form.categoryId),
    )
    return flattenCategoryTreeForSelect(visible)
  }, [categories, form.categoryId])

  const allBrands = useMemo(() => dbBrands.map((b) => b.name), [dbBrands])

  const validAttributes = useMemo(
    () =>
      form.attributes
        .filter((attribute) => normalizeText(attribute.name) && attribute.values.length)
        .map((attribute) => ({ name: normalizeText(attribute.name), values: attribute.values })),
    [form.attributes],
  )

  const baseUnitPrice = useMemo(() => {
    const baseUnit = form.units.find((u) => u.isBaseUnit) || form.units[0]
    return toNumber(baseUnit?.price, 0)
  }, [form.units])

  const generatedRows = useMemo(() => {
    const combinations = cartesianProduct(validAttributes)
    return form.units.map((unit) => ({
      ...unit,
      conversionRate: toNumber(unit.conversionRate, 1) || 1,
      unitName: normalizeText(unit.unitName) || '—',
    })).flatMap((unit) =>
      combinations.map((attributes) => {
        const key = buildVariantKey(unit, attributes)
        const draft = variantDrafts[key] || {}
        const costPrice = toNumber(form.costPrice) * unit.conversionRate
        const variantLabel = [unit.unitName, ...attributes.map((a) => a.value)].filter(Boolean).join(' ')
        const skuSuggestion = buildSkuPrefix(`${form.name} ${variantLabel}`)
        return {
          key,
          unit,
          attributes,
          skuCode: draft.skuCode ?? '',
          variantName: draft.variantName ?? '',
          skuSuggestion,
          barcode: draft.barcode ?? (unit.isBaseUnit ? form.barcode : unit.barcode) ?? '',
          costPrice,
          salePrice: draft.salePrice ?? unit.price ?? form.salePrice,
        }
      }),
    )
  }, [form.units, form.costPrice, form.salePrice, form.barcode, form.name, validAttributes, variantDrafts])

  const bomModalLines = useMemo(() => {
    if (!bomModalVariant) return []
    return bomByVariant[bomModalVariant.rowKey] ?? []
  }, [bomByVariant, bomModalVariant])

  useEffect(() => {
    setVariantDrafts((previous) => {
      const next = {}
      for (const row of generatedRows) {
        next[row.key] = {
          skuCode: previous[row.key]?.skuCode ?? row.skuCode ?? '',
          variantName: previous[row.key]?.variantName ?? row.variantName ?? '',
          barcode: previous[row.key]?.barcode ?? row.barcode ?? '',
          salePrice: previous[row.key]?.salePrice ?? row.salePrice ?? 0,
        }
      }
      return next
    })
  }, [form.units, validAttributes])

  // Sync default sale price → base unit price (create mode only)
  useEffect(() => {
    if (isEditMode) return
    const price = toNumber(form.salePrice, 0)
    if (price <= 0) return
    setForm((prev) => {
      const baseUnit = prev.units.find((u) => u.isBaseUnit) || prev.units[0]
      if (!baseUnit || toNumber(baseUnit.price) === price) return prev
      return {
        ...prev,
        units: prev.units.map((unit) => {
          const rate = toNumber(unit.conversionRate, 1) || 1
          return { ...unit, price: String(Math.round(price * rate)) }
        }),
      }
    })
    setVariantDrafts((prev) => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = { ...prev[k], salePrice: undefined }
      return next
    })
  }, [form.salePrice, isEditMode])

  function updateField(key, value) {
    if (key === 'name') setDuplicateProductName('')
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function updateUnit(index, key, value) {
    setForm((prev) => ({
      ...prev,
      units: prev.units.map((unit, itemIndex) => {
        if (itemIndex !== index) return unit
        const next = { ...unit, [key]: value }
        if (unit.isBaseUnit && key === 'conversionRate') next.conversionRate = '1'
        // Auto-calc price for non-base units when conversionRate changes
        if (!unit.isBaseUnit && key === 'conversionRate') {
          const base = prev.units.find((u) => u.isBaseUnit) || prev.units[0]
          const basePrice = toNumber(base?.price, 0)
          const rate = toNumber(value, 1) || 1
          next.price = String(basePrice * rate)
        }
        return next
      }),
    }))
    setFieldErrors((prev) => ({ ...prev, units: undefined }))
  }

  // When base unit price changes, recalc all non-base unit prices and reset variant sale prices
  function updateBaseUnitPrice(index, value) {
    setForm((prev) => {
      const basePrice = toNumber(value, 0)
      return {
        ...prev,
        units: prev.units.map((unit, i) => {
          if (i === index) return { ...unit, price: value }
          if (unit.isBaseUnit) return unit
          const rate = toNumber(unit.conversionRate, 1) || 1
          return { ...unit, price: String(basePrice * rate) }
        }),
      }
    })
    setVariantDrafts((prev) => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = { ...prev[k], salePrice: undefined }
      return next
    })
    setFieldErrors((prev) => ({ ...prev, units: undefined }))
  }

  function addUnit() {
    setForm((prev) => {
      const base = prev.units.find((u) => u.isBaseUnit) || prev.units[0]
      const basePrice = toNumber(base?.price, 0)
      return {
        ...prev,
        units: [
          ...prev.units,
          {
            ...EMPTY_UNIT,
            id: createLocalId('unit'),
            unitName: '',
            conversionRate: '1',
            price: String(basePrice),
            isBaseUnit: false,
          },
        ],
      }
    })
  }

  function removeUnit(index) {
    setForm((prev) => {
      const unit = prev.units[index]
      if (unit?.isBaseUnit) return prev
      return { ...prev, units: prev.units.filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  function setBaseUnit(index) {
    setForm((prev) => ({
      ...prev,
      units: prev.units.map((unit, itemIndex) => ({
        ...unit,
        isBaseUnit: itemIndex === index,
        conversionRate: itemIndex === index ? '1' : unit.conversionRate,
      })),
    }))
  }

  function updateAttribute(index, key, value) {
    setForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((attribute, itemIndex) =>
        itemIndex === index ? { ...attribute, [key]: value } : attribute,
      ),
    }))
  }

  function addAttribute() {
    setForm((prev) => ({
      ...prev,
      attributes: [...prev.attributes, { ...EMPTY_ATTRIBUTE, id: createLocalId('attr') }],
    }))
  }

  function removeAttribute(index) {
    setForm((prev) => {
      const attributes = prev.attributes.filter((_, itemIndex) => itemIndex !== index)
      return { ...prev, attributes: attributes.length ? attributes : [{ ...EMPTY_ATTRIBUTE, id: createLocalId('attr') }] }
    })
  }

  function commitAttributeValues(index, rawValue) {
    const values = String(rawValue || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (!values.length) return

    setForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((attribute, itemIndex) => {
        if (itemIndex !== index) return attribute
        return {
          ...attribute,
          inputValue: '',
          values: Array.from(new Set([...attribute.values, ...values])),
        }
      }),
    }))
  }

  function handleAttributeKeyDown(event, index) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    commitAttributeValues(index, event.currentTarget.value)
  }

  function removeAttributeValue(index, value) {
    setForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((attribute, itemIndex) =>
        itemIndex === index
          ? { ...attribute, values: attribute.values.filter((item) => item !== value) }
          : attribute,
      ),
    }))
  }

  function updateVariantDraft(rowKey, key, value) {
    setVariantDrafts((prev) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        [key]: value,
      },
    }))
  }

  function openBomModal(row) {
    setBomModalVariant({
      rowKey: row.key,
      sku: normalizeText(row.skuCode) || row.skuSuggestion,
      skuCode: normalizeText(row.skuCode) || row.skuSuggestion,
      productName: normalizeText(form.name) || 'Sản phẩm',
      attributeLabel: row.attributes.map((a) => a.value).join(' / ') || row.unit.unitName,
    })
  }

  function handleBomConfirm(lines) {
    if (!bomModalVariant) return
    setBomByVariant((prev) => ({ ...prev, [bomModalVariant.rowKey]: lines }))
  }

  function handleImagesChange(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const accepted = files.filter((file) => file.size <= MAX_IMAGE_SIZE)
    if (accepted.length !== files.length) showError('Một số ảnh vượt quá 2MB nên đã bị bỏ qua.')
    if (!accepted.length) return

    if (!hasCloudinaryUploadConfig()) {
      showError('Chưa cấu hình Cloudinary (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET). Không thể upload ảnh.')
      return
    }

    const queued = []
    setForm((prev) => {
      const available = MAX_IMAGES - prev.images.length
      const nextImages = accepted.slice(0, available).map((file, index) => {
        const entry = {
          id: createLocalId('image'),
          file,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          imageUrl: '',
          uploading: true,
          sortOrder: prev.images.length + index,
          isThumbnail: prev.images.length === 0 && index === 0,
        }
        queued.push(entry)
        return entry
      })
      return { ...prev, images: [...prev.images, ...nextImages] }
    })

    queued.forEach((entry) => {
      setUploadingImages((count) => count + 1)
      uploadImageToCloudinary(entry.file)
        .then((imageUrl) => {
          setForm((prev) => ({
            ...prev,
            images: prev.images.map((image) =>
              image.id === entry.id ? { ...image, imageUrl, uploading: false } : image,
            ),
          }))
        })
        .catch(() => {
          showError(`Không upload được ảnh "${entry.name}".`)
          setForm((prev) => {
            const images = prev.images.filter((image) => image.id !== entry.id)
            return {
              ...prev,
              images: images.map((image, index) => ({
                ...image,
                sortOrder: index,
                isThumbnail: images.some((item) => item.isThumbnail) ? image.isThumbnail : index === 0,
              })),
            }
          })
        })
        .finally(() => {
          setUploadingImages((count) => Math.max(0, count - 1))
        })
    })
  }

  function removeImage(imageId) {
    setForm((prev) => {
      const images = prev.images.filter((image) => image.id !== imageId)
      return {
        ...prev,
        images: images.map((image, index) => ({
          ...image,
          sortOrder: index,
          isThumbnail: images.some((item) => item.isThumbnail) ? image.isThumbnail : index === 0,
        })),
      }
    })
  }

  function setThumbnail(imageId) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((image) => ({ ...image, isThumbnail: image.id === imageId })),
    }))
  }

  function buildSubmitPayload() {
    const baseUnit = form.units.find((unit) => unit.isBaseUnit) || form.units[0]
    const cleanUnits = form.units
      .filter((unit) => normalizeText(unit.unitName))
      .map((unit) => ({
        unitName: normalizeText(unit.unitName),
        conversionRate: toNumber(unit.conversionRate, 1) || 1,
        price: unit.isBaseUnit
          ? toNumber(unit.price)
          : toNumber(baseUnitPrice) * (toNumber(unit.conversionRate, 1) || 1),
        barcode: normalizeText(unit.barcode) || null,
        isDirectSell: unit.isDirectSell !== false,
        isBaseUnit: Boolean(unit.isBaseUnit),
      }))

    const variants = generatedRows.map((row) => {
      const optionValues = row.attributes.reduce(
        (result, attribute) => ({ ...result, [attribute.name]: attribute.value }),
        { Unit: row.unit.unitName },
      )
      const attributeLabel = row.attributes.map((attribute) => attribute.value).join(' / ')
      const variantName = [form.name, row.unit.unitName, attributeLabel].map(normalizeText).filter(Boolean).join(' - ')

      return {
        skuCode: normalizeText(row.skuCode).toUpperCase(),
        barcode: normalizeText(row.barcode) || null,
        variantName: normalizeText(row.variantName) || variantName || normalizeText(form.name) || row.unit.unitName,
        optionValuesJson: JSON.stringify(optionValues),
        costPrice: toNumber(row.costPrice),
        retailPrice: toNumber(row.salePrice),
        minStock: toNumber(form.minStock),
        maxStock: toNumber(form.maxStock, 999999999),
        isSellable: isFinishedProduct && row.unit.isDirectSell !== false,
        allowRewardPoints: true,
        isPurchasable: form.isPurchasable !== false,
        isActive: true,
        imageUrl: form.images.find((image) => image.isThumbnail)?.imageUrl || null,
        bomLines: (bomByVariant[row.key] ?? []).map((line) => ({
          materialId: line.material_id,
          quantity: Number(line.quantity) || 0,
        })),
      }
    })

    return {
      productCode: normalizeText(form.productCode) || null,
      barcode: normalizeText(form.barcode) || null,
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      brandName: form.brandName || null,
      name: normalizeText(form.name),
      origin: form.brandName || form.origin || null,
      flavorProfile: form.flavorProfile || null,
      brewingGuide: form.brewingGuide || null,
      description: form.description || null,
      baseUnit: normalizeText(baseUnit?.unitName) || 'cái',
      weightValue: form.weightValue === '' ? null : toNumber(form.weightValue),
      weightUnit: form.weightUnit || 'g',
      productType,
      isVariantParent: isFinishedProduct && variants.length > 1,
      images: form.images
        .filter((image) => normalizeText(image.imageUrl))
        .map((image, index) => ({
          imageUrl: normalizeText(image.imageUrl),
          altText: image.name || form.name,
          sortOrder: index,
          isThumbnail: Boolean(image.isThumbnail),
        })),
      units: cleanUnits,
      variants,
      defaultPricing: {
        costPrice: toNumber(form.costPrice),
        salePrice: toNumber(form.salePrice),
      },
      stockConfig: {
        stockQuantity: toNumber(form.stockQuantity),
        minStock: toNumber(form.minStock),
        maxStock: toNumber(form.maxStock, 999999999),
      },
      attributes: isFinishedProduct ? validAttributes : [],
    }
  }

  function buildManualRowsForSnapshot(units, attributes) {
    const validSnapshotAttributes = attributes
      .filter((attribute) => normalizeText(attribute.name) && attribute.values.length)
      .map((attribute) => ({ name: normalizeText(attribute.name), values: attribute.values }))
    const combinations = cartesianProduct(validSnapshotAttributes)
    return units.map((unit) => ({
      ...unit,
      conversionRate: toNumber(unit.conversionRate, 1) || 1,
      unitName: normalizeText(unit.unitName) || '—',
    })).flatMap((unit) =>
      combinations.map((rowAttributes) => ({
        key: buildVariantKey(unit, rowAttributes),
        unit,
        attributes: rowAttributes,
      })),
    )
  }

  function findSnapshotVariantForRow(variants, row, fallbackIndex) {
    const matched = variants.find((variant) => {
      const options = parseOptionValuesJson(variant.optionValuesJson)
      const attributeMatched = row.attributes.every((attribute) =>
        normalizeComparableText(options[attribute.name]).toLowerCase() === normalizeComparableText(attribute.value).toLowerCase(),
      )
      if (!attributeMatched) return false

      const unitOptions = [options.Unit, options['Đơn vị'], options['Quy cách']].map(normalizeComparableText).filter(Boolean)
      return !unitOptions.length || unitOptions.some((value) => value.toLowerCase() === normalizeComparableText(row.unit.unitName).toLowerCase())
    })
    return matched || variants[fallbackIndex] || null
  }

  function applyApprovalSnapshotToManualForm(snapshot) {
    if (!snapshot) return
    const variants = Array.isArray(snapshot.variants) ? snapshot.variants : []
    const firstVariant = variants[0] || {}
    const snapshotUnits = Array.isArray(snapshot.units) && snapshot.units.length
      ? snapshot.units
      : [{
          unitName: snapshot.baseUnit || 'cái',
          conversionRate: 1,
          price: firstVariant.retailPrice ?? 0,
          barcode: '',
          isDirectSell: true,
          isBaseUnit: true,
        }]
    const mappedUnits = snapshotUnits.map((unit, index) => ({
      id: createLocalId('unit'),
      unitName: unit.unitName || (index === 0 ? snapshot.baseUnit : ''),
      conversionRate: String(unit.conversionRate || 1),
      price: String(unit.price ?? firstVariant.retailPrice ?? 0),
      barcode: unit.barcode || '',
      isDirectSell: unit.isDirectSell !== false,
      isBaseUnit: Boolean(unit.isBaseUnit || index === 0),
    }))

    const attributeValues = new Map()
    for (const variant of variants) {
      const options = parseOptionValuesJson(variant.optionValuesJson)
      for (const [name, value] of Object.entries(options)) {
        if (name === 'Unit' || !normalizeText(value)) continue
        if (!attributeValues.has(name)) attributeValues.set(name, new Set())
        attributeValues.get(name).add(String(value))
      }
    }
    const mappedAttributes = Array.from(attributeValues.entries()).map(([name, values]) => ({
      ...EMPTY_ATTRIBUTE,
      id: createLocalId('attr'),
      name,
      values: Array.from(values),
    }))
    const attributes = mappedAttributes.length ? mappedAttributes : [{ ...EMPTY_ATTRIBUTE, id: createLocalId('attr') }]
    const rows = buildManualRowsForSnapshot(mappedUnits, attributes)
    const nextVariantDrafts = {}
    const nextBomByVariant = {}
    rows.forEach((row, index) => {
      const variant = findSnapshotVariantForRow(variants, row, index)
      nextVariantDrafts[row.key] = {
        skuCode: variant?.skuCode || '',
        variantName: variant?.variantName || '',
        barcode: variant?.barcode || '',
        salePrice: String(variant?.retailPrice ?? row.unit.price ?? 0),
      }
      nextBomByVariant[row.key] = (Array.isArray(variant?.bomLines) ? variant.bomLines : []).map((line) => ({
        material_id: line.materialId ?? line.MaterialId,
        materialId: line.materialId ?? line.MaterialId,
        quantity: Number(line.quantity ?? line.Quantity ?? 0),
      }))
    })

    setProductType(snapshot.productType || PRODUCT_TYPES.THANH_PHAM)
    setForm((prev) => ({
      ...prev,
      productCode: '',
      barcode: firstVariant.barcode || '',
      name: snapshot.name || '',
      categoryId: snapshot.categoryId ? String(snapshot.categoryId) : '',
      brandId: '',
      brandName: '',
      origin: snapshot.origin || '',
      flavorProfile: snapshot.flavorProfile || '',
      brewingGuide: snapshot.brewingGuide || '',
      description: snapshot.description || '',
      costPrice: String(firstVariant.costPrice ?? 0),
      salePrice: String(firstVariant.retailPrice ?? mappedUnits.find((unit) => unit.isBaseUnit)?.price ?? 0),
      minStock: String(firstVariant.minStock ?? 0),
      maxStock: String(firstVariant.maxStock ?? 999999999),
      weightValue: snapshot.weightValue ?? '',
      weightUnit: snapshot.weightUnit || 'g',
      images: [],
      units: mappedUnits,
      attributes,
      isActive: true,
    }))
    setVariantDrafts(nextVariantDrafts)
    setBomByVariant(nextBomByVariant)
    setFieldErrors({})
    setDuplicateProductName('')
  }

  function handleSelectApprovalMode(mode) {
    setApprovalMode(mode)
    if (mode === 'manual') {
      applyApprovalSnapshotToManualForm(approvalRecord?.productSnapshot)
    }
  }

  async function handleValidateApprovalCode(event) {
    event.preventDefault()
    const code = approvalCode.trim().toUpperCase()
    if (!code) {
      showError('Vui lòng nhập mã phê duyệt.')
      return
    }

    try {
      setIsApprovalLoading(true)
      const result = await validateProductApprovalCode(code)
      if (!result.isValid || !result.approval) {
        showError(result.message || 'Mã phê duyệt không hợp lệ.')
        return
      }

      setApprovalCode(result.approval.approvalCode || code)
      setApprovalRecord(result.approval)
      setApprovalMode('')
      setPendingManualPayload(null)
      showSuccess('Mã phê duyệt hợp lệ.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsApprovalLoading(false)
    }
  }

  function resetApprovalCode() {
    setApprovalRecord(null)
    setApprovalMode('')
    setApprovalCode('')
    setManualModeReason('')
    setPendingManualPayload(null)
  }

  async function handleAutomaticCreation() {
    if (!approvalRecord?.approvalCode) {
      showError('Vui lòng kiểm tra mã phê duyệt trước khi tạo tự động.')
      return
    }
    if (isCategoryUnavailable(categories, approvalRecord.productSnapshot?.categoryId)) {
      showError(APPROVAL_CATEGORY_UNAVAILABLE_MESSAGE)
      return
    }

    try {
      setIsAutomaticCreating(true)
      const result = await createProductFromApproval(approvalRecord.approvalCode)
      const created = result.product
      setProductListFocus(created, { showBanner: true })
      showSuccess(`Đã tạo "${created.name}" từ biên bản phê duyệt.`)
      navigate(`/inventory/products?highlight=${created.id}`, {
        replace: true,
        state: { createdName: created.name },
      })
    } catch (error) {
      showError(error.message)
    } finally {
      setIsAutomaticCreating(false)
    }
  }

  async function handleManualConfirmSubmit() {
    if (!pendingManualPayload || !approvalRecord?.approvalCode) return
    try {
      setIsSaving(true)
      const result = await createProductManualFromApproval({
        approvalCode: approvalRecord.approvalCode,
        product: pendingManualPayload,
        manualModeReason,
      })
      const created = result.product
      setProductListFocus(created, { showBanner: true })
      showSuccess(`Đã tạo "${created.name}" bằng nhập thủ công theo mã phê duyệt.`)
      navigate(`/inventory/products?highlight=${created.id}`, {
        replace: true,
        state: { createdName: created.name },
      })
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))
      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
      if (mapped.duplicateProduct) {
        setDuplicateProductName(normalizeText(form.name))
      }
      showError(mapped.message)
    } finally {
      setIsSaving(false)
      setPendingManualPayload(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canEdit) {
      showError('Chỉ Thủ kho Kho tổng được tạo và sửa sản phẩm.')
      return
    }

    if (uploadingImages > 0) {
      showError('Vui lòng đợi ảnh tải lên hoàn tất trước khi lưu.')
      return
    }

    const payload = buildSubmitPayload()

    const validation = validateProductForm(payload)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    try {
      setIsSaving(true)
      if (isEditMode && id) {
        await updateProduct(id, payload)
        showSuccess('Đã cập nhật sản phẩm.')
      } else {
        if (!approvalRecord?.approvalCode) {
          showError('Sản phẩm mới cần mã phê duyệt hợp lệ do Admin cấp.')
          return
        }
        if (approvalMode !== 'manual') {
          showError('Vui lòng chọn chế độ tạo sản phẩm.')
          return
        }
        if (isCategoryUnavailable(categories, approvalRecord.productSnapshot?.categoryId)) {
          setFieldErrors((prev) => ({ ...prev, categoryId: APPROVAL_CATEGORY_UNAVAILABLE_MESSAGE }))
          showError(APPROVAL_CATEGORY_UNAVAILABLE_MESSAGE)
          return
        }
        const reason = manualModeReason.trim()
        if (!reason) {
          showError('Vui lòng nhập lý do nhập thủ công.')
          return
        }
        if (reason.length < 5) {
          showError('Lý do nhập thủ công phải có ít nhất 5 ký tự.')
          return
        }
        if (reason.length > 1000) {
          showError('Lý do nhập thủ công tối đa 1000 ký tự.')
          return
        }
        const differences = compareApprovalProducts(approvalRecord.productSnapshot, payload)
        if (differences.length) {
          showError(`Dữ liệu nhập thủ công khác với biên bản đã được Admin phê duyệt. ${differences.slice(0, 6).join('; ')}.`)
          return
        }
        setPendingManualPayload(payload)
        return
      }
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))
      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
      if (mapped.duplicateProduct) {
        setDuplicateProductName(normalizeText(form.name))
      } else {
        setDuplicateProductName('')
      }
      showError(mapped.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-slate-500">Đang tải sản phẩm...</p>
      </PageShell>
    )
  }

  if (!isEditMode && canEdit && !approvalRecord) {
    return (
      <ApprovalCodeGate
        approvalCode={approvalCode}
        onCodeChange={setApprovalCode}
        onValidate={handleValidateApprovalCode}
        isLoading={isApprovalLoading}
        pendingApprovals={pendingApprovals}
        categories={categories}
      />
    )
  }

  if (!isEditMode && canEdit && approvalRecord && !approvalMode) {
    return (
      <ApprovalModeSelection
        approval={approvalRecord}
        categories={categories}
        onSelectMode={handleSelectApprovalMode}
        onReset={resetApprovalCode}
      />
    )
  }

  if (!isEditMode && canEdit && approvalRecord && approvalMode === 'automatic') {
    return (
      <AutomaticApprovalCreatePage
        approval={approvalRecord}
        categories={categories}
        onCreate={handleAutomaticCreation}
        onBack={() => setApprovalMode('')}
        isSaving={isAutomaticCreating}
      />
    )
  }

  if (stockOnlyAccess && id) {
    return (
      <PageShell>
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Gửi yêu cầu bổ sung tồn quầy</h1>
              <p className="mt-1 text-sm text-slate-500">
                {form.name ? (
                  <>
                    Sản phẩm: <span className="font-semibold text-[#356647]">{form.name}</span> — thêm SKU vào lô chung
                    (có thể quay lại danh sách hàng hóa thêm SKU khác trước khi gửi).
                  </>
                ) : (
                  'Thêm SKU vào lô chung (giữ khi chuyển trang), rồi gửi yêu cầu để Thủ kho Kho tổng duyệt bổ sung tồn quầy POS mặc định.'
                )}
              </p>
            </div>
            <Link
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              to="/inventory/products"
            >
              Quay lại
            </Link>
          </div>
          <ProductSkusPanel
            productId={id}
            productName={form.name}
            canManage={false}
            canAdjustStock
            warehouseStockView={false}
            layout="column"
            stockOnlyMode
          />
        </div>
      </PageShell>
    )
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-100 disabled:text-slate-500'
  const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500'

  return (
    <PageShell>
      <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">{isEditMode ? 'Sửa hàng hóa' : 'Tạo hàng hóa mới'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Form hàng hóa theo mô hình ERP/POS: đơn vị tính, thuộc tính và bảng hàng cùng loại tự sinh.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" to="/inventory/products">
              Quay lại
            </Link>
            <button type="submit" disabled={isSaving || uploadingImages > 0} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : uploadingImages > 0 ? 'Đang tải ảnh...' : isEditMode ? 'Cập nhật' : 'Tiếp tục xác nhận'}
            </button>
          </div>
        </div>

        {!isEditMode && approvalRecord ? (
          <section className="rounded-[1rem] border border-[#356647]/20 bg-[#f7fbf8] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#356647]">Mã phê duyệt</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">{approvalRecord.approvalCode}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập thủ công theo biên bản Admin đã duyệt cho <span className="font-semibold text-slate-800">{approvalRecord.productName}</span>.
                </p>
              </div>
              <button type="button" onClick={() => setApprovalMode('')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Chọn lại chế độ
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold text-slate-800">Thông tin đã được Admin phê duyệt</h2>
              <div className="mt-3">
                <ApprovalProductPreview product={approvalRecord.productSnapshot} categories={categories} />
              </div>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Lý do nhập thủ công *</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
                value={manualModeReason}
                onChange={(event) => setManualModeReason(event.target.value)}
                placeholder="VD: Admin duyệt theo biên bản giấy, Thủ kho Kho tổng nhập lại dữ liệu từ chứng từ đã ký."
              />
            </label>
          </section>
        ) : null}

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <h2 className="text-lg font-bold text-slate-800">Thông tin cơ bản</h2>

          <div className="mt-4 flex flex-wrap gap-6">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="productType"
                checked={productType === PRODUCT_TYPES.NGUYEN_LIEU}
                onChange={() => setProductType(PRODUCT_TYPES.NGUYEN_LIEU)}
                className="text-[#356647] focus:ring-[#356647]"
              />
              <span className="text-sm font-medium text-slate-800">Nguyên liệu / Bao bì</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="productType"
                checked={productType === PRODUCT_TYPES.THANH_PHAM}
                onChange={() => setProductType(PRODUCT_TYPES.THANH_PHAM)}
                className="text-[#356647] focus:ring-[#356647]"
              />
              <span className="text-sm font-medium text-slate-800">Thành phẩm kinh doanh</span>
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className={labelClass}>Tên hàng *</span>
              <input className={`${inputClass} ${fieldErrors.name ? 'border-[#b42318] ring-2 ring-[#b42318]/20' : ''}`} required value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <FieldError message={fieldErrors.name} />
              {duplicateProductName ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  <p>Sản phẩm này có thể đã bị ẩn trước đó và không hiện trong danh sách mặc định.</p>
                  <Link
                    to="/inventory/products"
                    className="mt-2 inline-flex items-center gap-1 font-semibold text-[#356647] hover:underline"
                    onClick={() => setProductListFocus({ name: duplicateProductName }, { statusFilter: 'all' })}
                  >
                    <span className="material-symbols-outlined text-[16px]">search</span>
                    Tìm &quot;{duplicateProductName}&quot; trong danh sách và kích hoạt lại
                  </Link>
                </div>
              ) : null}
            </label>
            <label>
              <span className={labelClass}>Mã hàng</span>
              <input className={inputClass} value={form.productCode} onChange={(event) => updateField('productCode', event.target.value)} placeholder="Tự động" />
            </label>
            <label>
              <span className={labelClass}>Mã vạch</span>
              <input className={inputClass} value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
            </label>

            {/* Nhóm hàng with create button */}
            <div>
              <span className={labelClass}>Nhóm hàng *</span>
              <div className="mt-1 flex gap-2">
                <select
                  className={`flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 ${fieldErrors.categoryId ? 'border-[#b42318] ring-2 ring-[#b42318]/20' : ''}`}
                  value={form.categoryId}
                  onChange={(event) => updateField('categoryId', event.target.value)}
                >
                  <option value="">Chọn nhóm hàng</option>
                  {categoryTreeOptions.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.pathLabel}{cat.isActive === false || cat.isDeleted ? ' (đã ẩn)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateCategory(true)}
                  className="shrink-0 rounded-xl border border-[#356647]/30 bg-[#f0eee6] px-3 py-2.5 text-sm font-bold text-[#356647] hover:bg-[#e8f1eb]"
                  title="Tạo nhóm hàng mới"
                >
                  + Tạo mới
                </button>
              </div>
              <FieldError message={fieldErrors.categoryId} />
            </div>

            {/* Thương hiệu with create button */}
            <div>
              <span className={labelClass}>Thương hiệu</span>
              <div className="mt-1 flex gap-2">
                <select
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
                  value={form.brandName}
                  onChange={(event) => updateField('brandName', event.target.value)}
                >
                  <option value="">Không có thương hiệu</option>
                  {allBrands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateBrand(true)}
                  className="shrink-0 rounded-xl border border-[#356647]/30 bg-[#f0eee6] px-3 py-2.5 text-sm font-bold text-[#356647] hover:bg-[#e8f1eb]"
                  title="Tạo thương hiệu mới"
                >
                  + Tạo mới
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-[#fbf9f1] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-700">Upload ảnh</p>
                <p className="text-xs text-slate-500">Tối đa {MAX_IMAGES} ảnh, mỗi ảnh nhỏ hơn 2MB. Ảnh được lưu trên Cloudinary, hệ thống chỉ lưu đường dẫn ảnh.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]">
                {uploadingImages > 0 ? 'Đang tải ảnh...' : 'Chọn ảnh'}
                <input type="file" accept="image/*" multiple disabled={form.images.length >= MAX_IMAGES} onChange={handleImagesChange} className="hidden" />
              </label>
            </div>
            {form.images.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {form.images.map((image) => (
                  <div key={image.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={image.previewUrl || image.imageUrl} alt={image.name} className="h-28 w-full object-cover" />
                    {image.uploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-bold text-white">
                        Đang tải...
                      </div>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/90 px-2 py-1">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                        <input type="radio" checked={image.isThumbnail} onChange={() => setThumbnail(image.id)} />
                        Đại diện
                      </label>
                      <button type="button" className="text-[11px] font-bold text-[#b42318]" onClick={() => removeImage(image.id)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <h2 className="text-lg font-bold text-slate-800">Giá & Tồn kho mặc định</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Giá vốn</span>
              <CurrencyInput className={inputClass} value={form.costPrice} onChange={(v) => updateField('costPrice', v)} />
            </label>
            <label>
              <span className={labelClass}>Giá bán</span>
              <CurrencyInput className={inputClass} value={form.salePrice} onChange={(v) => updateField('salePrice', v)} />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={labelClass}>Tồn kho</span>
              <input type="number" disabled className={`${inputClass} bg-slate-50 text-slate-400`} value={form.stockQuantity} onChange={(event) => updateField('stockQuantity', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Tồn tối thiểu</span>
              <input type="number" min="0" className={inputClass} value={form.minStock} onChange={(event) => updateField('minStock', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Tồn tối đa</span>
              <input type="number" min="0" className={inputClass} value={form.maxStock} onChange={(event) => updateField('maxStock', event.target.value)} />
            </label>
            <div>
              <span className={labelClass}>Trọng lượng</span>
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.weightValue} onChange={(event) => updateField('weightValue', event.target.value)} />
                <select className="w-20 shrink-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.weightUnit} onChange={(event) => updateField('weightUnit', event.target.value)}>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <FieldError message={fieldErrors.weightValue || fieldErrors.weightUnit} />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#c1c9c0] bg-[#f5f7f4] px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#356647]"
              checked={form.isPurchasable !== false}
              onChange={(event) => updateField('isPurchasable', event.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-[#1b1c17]">Mua từ nhà cung cấp</span>
              <span className="block text-xs text-[#717971]">
                Bật để mặt hàng này xuất hiện trong danh mục hàng cung ứng khi lập phiếu nhập từ nhà cung cấp.
                Bỏ tick nếu chỉ tự sản xuất, không nhập ngoài.
              </span>
            </span>
          </label>
        </section>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Quản lý đơn vị tính</h2>
              <p className="text-sm text-slate-500">Dòng đầu là đơn vị cơ bản. Các đơn vị khác tự tính giá bán = Giá bán cơ bản × Quy đổi.</p>
            </div>
            <button type="button" onClick={addUnit} className="rounded-xl border border-[#356647]/30 px-4 py-2 text-sm font-bold text-[#356647] hover:bg-[#f0eee6]">
              + Thêm đơn vị
            </button>
          </div>
          <FieldError message={fieldErrors.units} />
          <div className="mt-4 space-y-3">
            {form.units.map((unit, index) => (
              <div key={unit.id} className="grid gap-3 rounded-xl border border-slate-100 bg-[#fbf9f1] p-3 md:grid-cols-[2fr_80px_200px_160px_auto]">
                <label>
                  <span className="text-xs font-semibold text-slate-500">{unit.isBaseUnit ? 'Tên đơn vị cơ bản' : 'Tên đơn vị'}</span>
                  <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder={unit.isBaseUnit ? 'VD: cái' : 'VD: thùng'} value={unit.unitName} onChange={(event) => updateUnit(index, 'unitName', event.target.value)} />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-500">Quy đổi</span>
                  <input
                    type="number"
                    min="1"
                    disabled={unit.isBaseUnit}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    value={unit.conversionRate}
                    onChange={(event) => updateUnit(index, 'conversionRate', event.target.value)}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-500">
                    Giá bán{!unit.isBaseUnit ? <span className="ml-1 text-[10px] text-slate-400">(tự tính)</span> : null}
                  </span>
                  <CurrencyInput
                    disabled={!unit.isBaseUnit}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={unit.isBaseUnit ? unit.price : String(Math.round(baseUnitPrice * (toNumber(unit.conversionRate, 1) || 1)))}
                    onChange={unit.isBaseUnit ? (v) => updateBaseUnitPrice(index, v) : undefined}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-500">Barcode</span>
                  <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={unit.barcode} onChange={(event) => updateUnit(index, 'barcode', event.target.value)} />
                </label>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="radio" checked={unit.isBaseUnit} onChange={() => setBaseUnit(index)} />
                    Cơ bản
                  </label>
                  {isFinishedProduct ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={unit.isDirectSell} onChange={(event) => updateUnit(index, 'isDirectSell', event.target.checked)} />
                      Bán trực tiếp
                    </label>
                  ) : null}
                  {!unit.isBaseUnit ? (
                    <button type="button" className="text-left text-xs font-bold text-[#b42318]" onClick={() => removeUnit(index)}>
                      Xóa
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {!isFinishedProduct ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Nguyên liệu / bao bì — không hiện trên POS thu ngân và không tạo biến thể.
            </p>
          ) : null}
        </section>

        {isFinishedProduct ? (
            <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Thuộc tính</h2>
                  <p className="text-sm text-slate-500">Nhập giá trị bằng dấu phẩy hoặc nhấn Enter để tạo tag.</p>
                </div>
                <button type="button" onClick={addAttribute} className="rounded-xl border border-[#356647]/30 px-4 py-2 text-sm font-bold text-[#356647] hover:bg-[#f0eee6]">
                  + Thêm thuộc tính
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {form.attributes.map((attribute, index) => (
                  <div key={attribute.id} className="rounded-xl border border-slate-100 bg-[#fbf9f1] p-3">
                    <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={attribute.name}
                        onChange={(event) => {
                          if (event.target.value === '__create__') {
                            setAddAttrNameModal({ open: true, forIndex: index })
                          } else {
                            updateAttribute(index, 'name', event.target.value)
                          }
                        }}
                      >
                        <option value="">Chọn tên thuộc tính</option>
                        {[...new Set([...ATTRIBUTE_OPTIONS, ...dbAttributeNames.map((item) => item.name), ...customAttrNames])].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                        <option value="__create__">+ Tạo tên mới...</option>
                      </select>
                      <input
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="VD: Đỏ, Xanh hoặc S, M, L"
                        value={attribute.inputValue}
                        onChange={(event) => updateAttribute(index, 'inputValue', event.target.value)}
                        onKeyDown={(event) => handleAttributeKeyDown(event, index)}
                        onBlur={(event) => commitAttributeValues(index, event.target.value)}
                      />
                      <button type="button" className="rounded-lg px-3 py-2 text-sm font-bold text-[#b42318] hover:bg-red-50" onClick={() => removeAttribute(index)}>
                        Xóa
                      </button>
                    </div>
                    {attribute.values.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {attribute.values.map((value) => (
                          <button key={value} type="button" onClick={() => removeAttributeValue(index, value)} className="rounded-full bg-[#e8f1eb] px-3 py-1 text-xs font-bold text-[#356647]">
                            {value} ×
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
        ) : null}

        {isFinishedProduct ? (
          <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">SKU & BOM thành phẩm</h2>
                <p className="text-sm text-slate-500">SKU được tạo theo đơn vị tính và thuộc tính. Có thể để trống mã SKU để backend tự sinh.</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Tên biến thể</th>
                    <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                    <th className="px-4 py-3 text-center font-semibold">BOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {generatedRows.map((row) => {
                    const bomLines = bomByVariant[row.key] ?? []
                    const attributeLabel = row.attributes.map((attribute) => attribute.value).join(' / ')
                    const variantName = [form.name, row.unit.unitName, attributeLabel].map(normalizeText).filter(Boolean).join(' - ')
                    return (
                      <tr key={row.key}>
                        <td className="px-4 py-3">
                          <input
                            className="w-44 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs uppercase outline-none focus:border-[#538463]"
                            value={row.skuCode}
                            onChange={(event) => updateVariantDraft(row.key, 'skuCode', event.target.value.toUpperCase())}
                            placeholder={row.skuSuggestion || 'Tự sinh'}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{variantName || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <CurrencyInput
                            className="ml-auto w-32 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-[#538463]"
                            value={row.salePrice}
                            onChange={(value) => updateVariantDraft(row.key, 'salePrice', value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => openBomModal(row)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#356647]/30 px-3 py-2 text-xs font-bold text-[#356647] hover:bg-[#f0eee6]"
                          >
                            <span className="material-symbols-outlined text-[16px]">schema</span>
                            {bomLines.length ? `${bomLines.length} dòng` : 'Cấu hình'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </form>

        {isEditMode && id ? (
          <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <ProductVariantsPanel variants={productVariants} productName={form.name} />
          </section>
        ) : null}
      </div>

      <CreateCategoryModal
        isOpen={showCreateCategory}
        categories={categories}
        onClose={() => setShowCreateCategory(false)}
        onCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat])
          updateField('categoryId', String(newCat.id))
          showSuccess(`Đã tạo nhóm "${newCat.name}"`)
        }}
      />

      <CreateBrandModal
        isOpen={showCreateBrand}
        onClose={() => setShowCreateBrand(false)}
        onCreated={(brand) => {
          setDbBrands((prev) => [...prev, brand])
          updateField('brandName', brand.name)
          showSuccess(`Đã tạo thương hiệu "${brand.name}"`)
        }}
      />

      <CreateAttributeNameModal
        isOpen={addAttrNameModal.open}
        onClose={() => setAddAttrNameModal({ open: false, forIndex: null })}
        onCreated={(created) => {
          setDbAttributeNames((prev) => [...prev, created])
          if (addAttrNameModal.forIndex !== null) {
            updateAttribute(addAttrNameModal.forIndex, 'name', created.name)
          }
        }}
      />

      <ProductBomConfigModal
        isOpen={Boolean(bomModalVariant)}
        variant={bomModalVariant}
        initialLines={bomModalLines}
        onClose={() => setBomModalVariant(null)}
        onConfirm={handleBomConfirm}
      />

      <ManualCreationConfirmModal
        payload={pendingManualPayload}
        approval={approvalRecord}
        reason={manualModeReason}
        categories={categories}
        onClose={() => setPendingManualPayload(null)}
        onConfirm={handleManualConfirmSubmit}
        isSaving={isSaving}
      />
    </PageShell>
  )
}

export default ProductFormPage
