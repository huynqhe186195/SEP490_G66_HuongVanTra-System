import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canAdjustStoreStock, canCreateCatalog } from '../../auth/utils/permissions.js'
import ProductBomConfigModal from '../components/ProductBomConfigModal.jsx'
import ProductSkusPanel from '../components/ProductSkusPanel.jsx'
import { createCategory, fetchCategories } from '../services/categoriesApi.js'
import { createBrand, fetchBrands } from '../services/brandsApi.js'
import { createAttributeName, fetchAttributeNames } from '../services/attributeNamesApi.js'
import { createProduct, fetchProductById, updateProduct } from '../services/productsApi.js'
import { mapProductApiError, validateProductForm } from '../utils/productValidation.js'

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

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-[#b42318]">{message}</p>
}

// Build a flat list with depth info from a nested category tree
function buildCategoryTree(categories) {
  const byId = {}
  for (const cat of categories) byId[String(cat.id)] = { ...cat, children: [] }
  const roots = []
  for (const cat of categories) {
    const pid = cat.parentId ? String(cat.parentId) : null
    if (pid && byId[pid]) byId[pid].children.push(byId[String(cat.id)])
    else roots.push(byId[String(cat.id)])
  }
  const flat = []
  function walk(node, depth) {
    flat.push({ ...node, depth })
    for (const child of node.children) walk(child, depth + 1)
  }
  for (const root of roots) walk(root, 0)
  return flat
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

  const treeOptions = buildCategoryTree(
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
                  {'  '.repeat(cat.depth)}{cat.depth > 0 ? '└ ' : ''}{cat.name}
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

function ProductFormPage({ mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = mode === 'edit' || Boolean(id)
  const [session, setSession] = useState(() => loadAuthSession())
  const canEdit = canCreateCatalog(session)
  const canAdjustStock = canAdjustStoreStock(session)

  const [categories, setCategories] = useState([])
  const [dbBrands, setDbBrands] = useState([])
  const [dbAttributeNames, setDbAttributeNames] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [variantDrafts, setVariantDrafts] = useState({})
  const [productType, setProductType] = useState(PRODUCT_TYPES.THANH_PHAM)
  const [bomByVariant, setBomByVariant] = useState({})
  const [bomModalVariant, setBomModalVariant] = useState(null)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [customAttrNames, setCustomAttrNames] = useState([])
  const [addAttrNameModal, setAddAttrNameModal] = useState({ open: false, forIndex: null })
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
        const items = await fetchCategories()
        if (mounted) setCategories(items)
      } catch (error) {
        if (mounted) showError(error.message)
      }
    }
    loadCategories()
    return () => { mounted = false }
  }, [])

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
    if (!canEdit) navigate('/inventory/products', { replace: true })
  }, [canEdit, navigate])

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
        }))
        setProductType(product.productType || PRODUCT_TYPES.THANH_PHAM)
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
    return buildCategoryTree(visible)
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
        return {
          key,
          unit,
          attributes,
          skuCode: draft.skuCode ?? '',
          barcode: draft.barcode ?? (unit.isBaseUnit ? form.barcode : unit.barcode) ?? '',
          costPrice,
          salePrice: draft.salePrice ?? unit.price ?? form.salePrice,
        }
      }),
    )
  }, [form.units, form.costPrice, form.salePrice, form.barcode, validAttributes, variantDrafts])

  useEffect(() => {
    setVariantDrafts((previous) => {
      const next = {}
      for (const row of generatedRows) {
        next[row.key] = {
          skuCode: previous[row.key]?.skuCode ?? row.skuCode ?? '',
          barcode: previous[row.key]?.barcode ?? row.barcode ?? '',
          salePrice: previous[row.key]?.salePrice ?? row.salePrice ?? 0,
        }
      }
      return next
    })
  }, [form.units, validAttributes])

  function updateField(key, value) {
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

  // When base unit price changes, recalc all non-base unit prices
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
    const accepted = files.filter((file) => file.size <= MAX_IMAGE_SIZE)
    if (accepted.length !== files.length) showError('Một số ảnh vượt quá 2MB nên đã bị bỏ qua.')

    setForm((prev) => {
      const available = MAX_IMAGES - prev.images.length
      const nextImages = accepted.slice(0, available).map((file, index) => ({
        id: createLocalId('image'),
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        imageUrl: '',
        sortOrder: prev.images.length + index,
        isThumbnail: prev.images.length === 0 && index === 0,
      }))
      return { ...prev, images: [...prev.images, ...nextImages] }
    })
    event.target.value = ''
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
        variantName: variantName || normalizeText(form.name) || row.unit.unitName,
        optionValuesJson: JSON.stringify(optionValues),
        costPrice: toNumber(row.costPrice),
        retailPrice: toNumber(row.salePrice),
        minStock: toNumber(form.minStock),
        maxStock: toNumber(form.maxStock, 999999999),
        isSellable: isFinishedProduct && row.unit.isDirectSell !== false,
        allowRewardPoints: true,
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
      variants: isFinishedProduct ? variants : [],
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

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canEdit) {
      showError('Chỉ Thủ kho được tạo và sửa sản phẩm.')
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
        const created = await createProduct(payload)
        showSuccess('Đã tạo sản phẩm. Bạn có thể thêm SKU ngay bây giờ.')
        navigate(`/products/${created.id}/edit`, { replace: true })
      }
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))
      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
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

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-100 disabled:text-slate-500'
  const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500'

  return (
    <PageShell>
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
            <button type="submit" disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu hàng hóa'}
            </button>
          </div>
        </div>

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
                      {'  '.repeat(cat.depth * 2)}{cat.depth > 0 ? '└ ' : ''}{cat.name}{cat.isActive === false || cat.isDeleted ? ' (đã ẩn)' : ''}
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
                <p className="text-xs text-slate-500">Tối đa {MAX_IMAGES} ảnh, mỗi ảnh nhỏ hơn 2MB. Nếu backend chưa có upload file, ảnh sẽ chỉ preview local.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]">
                Chọn ảnh
                <input type="file" accept="image/*" multiple disabled={form.images.length >= MAX_IMAGES} onChange={handleImagesChange} className="hidden" />
              </label>
            </div>
            {form.images.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {form.images.map((image) => (
                  <div key={image.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={image.previewUrl || image.imageUrl} alt={image.name} className="h-28 w-full object-cover" />
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
          <>
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

            {/* Section 5: only show when there are 2+ rows (i.e. multiple units or attributes) */}
            {form.units.filter((u) => u.unitName?.trim()).length >= 2 ? (
              <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Hàng cùng loại</h2>
                    <p className="text-sm text-slate-500">Bảng sinh từ Đơn vị tính × Thuộc tính. Giá vốn tự tính theo quy đổi. Giá bán có thể ghi đè — nhấn <span className="material-symbols-outlined align-[-3px] text-[13px]">restart_alt</span> để về giá tự tính.</p>
                  </div>
                  <span className="rounded-full bg-[#f0eee6] px-3 py-1 text-sm font-bold text-slate-700">{generatedRows.length} dòng</span>
                </div>
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[18%]" />
                      {validAttributes.length > 0 ? <col className="w-[22%]" /> : null}
                      <col className="w-[8%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                      <col className={validAttributes.length > 0 ? 'w-[12%]' : 'w-[24%]'} />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Đơn vị</th>
                        {validAttributes.length > 0 ? <th className="px-3 py-3">Thuộc tính</th> : null}
                        <th className="px-3 py-3 text-center">Q. đổi</th>
                        <th className="px-3 py-3">Mã hàng</th>
                        <th className="px-3 py-3">Giá vốn</th>
                        <th className="px-3 py-3">Giá bán</th>
                        <th className="px-3 py-3 text-center">BOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {generatedRows.map((row) => {
                        const bomCount = bomByVariant[row.key]?.length ?? 0
                        const autoSalePrice = Math.round(baseUnitPrice * row.unit.conversionRate)
                        const draftSalePrice = toNumber(variantDrafts[row.key]?.salePrice ?? autoSalePrice)
                        const isOverridden = draftSalePrice !== autoSalePrice
                        return (
                          <tr key={row.key} className="hover:bg-[#fbf9f1]">
                            <td className="px-3 py-2.5 font-bold text-[#356647]">{row.unit.unitName}</td>
                            {validAttributes.length > 0 ? (
                              <td className="px-3 py-2.5">
                                {row.attributes.length ? (
                                  <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                                    {row.attributes.map((attribute) => (
                                      <span key={`${row.key}-${attribute.name}-${attribute.value}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                        {attribute.name}: {attribute.value}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            ) : null}
                            <td className="px-3 py-2.5 text-center text-slate-600">{row.unit.conversionRate}</td>
                            <td className="px-3 py-2.5">
                              <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm" placeholder="Tự động" value={row.skuCode} onChange={(event) => updateVariantDraft(row.key, 'skuCode', event.target.value)} />
                            </td>
                            <td className="px-3 py-2.5">
                              <input readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" value={formatCurrency(row.costPrice)} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <CurrencyInput
                                  className={`w-full rounded-lg border px-2 py-1.5 text-sm font-semibold ${isOverridden ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-100 bg-slate-50 text-[#356647]'}`}
                                  value={String(draftSalePrice)}
                                  onChange={(v) => updateVariantDraft(row.key, 'salePrice', v)}
                                />
                                {isOverridden ? (
                                  <button
                                    type="button"
                                    title="Về giá tự tính"
                                    onClick={() => updateVariantDraft(row.key, 'salePrice', String(autoSalePrice))}
                                    className="shrink-0 rounded-md p-1 text-amber-500 hover:bg-amber-100"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => openBomModal(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-2.5 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
                              >
                                <span className="material-symbols-outlined text-[15px]">settings</span>
                                {bomCount > 0 ? (
                                  <span className="rounded-full bg-[#356647] px-1.5 py-0.5 text-[10px] text-white">{bomCount}</span>
                                ) : null}
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
          </>
        ) : null}

        {isEditMode && id ? (
          <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <ProductSkusPanel productId={id} canManage={canEdit} canAdjustStock={canAdjustStock} warehouseStockView={canEdit} layout="column" />
          </section>
        ) : null}
      </form>

      <ProductBomConfigModal
        isOpen={Boolean(bomModalVariant)}
        variant={bomModalVariant}
        initialLines={bomModalVariant ? (bomByVariant[bomModalVariant.rowKey] ?? []) : []}
        onClose={() => setBomModalVariant(null)}
        onConfirm={handleBomConfirm}
      />

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
    </PageShell>
  )
}

export default ProductFormPage
