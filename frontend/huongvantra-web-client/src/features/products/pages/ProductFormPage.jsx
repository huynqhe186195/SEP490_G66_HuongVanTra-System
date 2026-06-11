import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canAdjustStoreStock, canCreateCatalog } from '../../auth/utils/permissions.js'
import ProductSkusPanel from '../components/ProductSkusPanel.jsx'
import { fetchCategories } from '../services/categoriesApi.js'
import { createProduct, fetchProductById, updateProduct } from '../services/productsApi.js'
import { mapProductApiError, validateProductForm } from '../utils/productValidation.js'

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

function ProductFormPage({ mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = mode === 'edit' || Boolean(id)
  const [session, setSession] = useState(() => loadAuthSession())
  const canEdit = canCreateCatalog(session)
  const canAdjustStock = canAdjustStoreStock(session)

  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [variantDrafts, setVariantDrafts] = useState({})

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
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!canEdit) navigate('/products', { replace: true })
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
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadProduct()
    return () => {
      mounted = false
    }
  }, [id, isEditMode])

  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          (!category.isDeleted && category.isActive !== false) || String(category.id) === String(form.categoryId),
      ),
    [categories, form.categoryId],
  )

  const validAttributes = useMemo(
    () =>
      form.attributes
        .filter((attribute) => normalizeText(attribute.name) && attribute.values.length)
        .map((attribute) => ({ name: normalizeText(attribute.name), values: attribute.values })),
    [form.attributes],
  )

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
        return next
      }),
    }))
    setFieldErrors((prev) => ({ ...prev, units: undefined }))
  }

  function addUnit() {
    setForm((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          ...EMPTY_UNIT,
          id: createLocalId('unit'),
          unitName: '',
          conversionRate: '1',
          price: prev.salePrice,
          isBaseUnit: false,
        },
      ],
    }))
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
        price: toNumber(unit.price),
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
        isSellable: row.unit.isDirectSell !== false,
        allowRewardPoints: true,
        isActive: true,
        imageUrl: form.images.find((image) => image.isThumbnail)?.imageUrl || null,
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
      isVariantParent: variants.length > 1,
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
      attributes: validAttributes,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canEdit) {
      showError('Chỉ Thủ kho được tạo và sửa sản phẩm.')
      return
    }

    const payload = buildSubmitPayload()
    console.log('CREATE_PRODUCT_PAYLOAD', payload)

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
            <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" to="/products">
              Quay lại
            </Link>
            <button type="submit" disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu hàng hóa'}
            </button>
          </div>
        </div>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <h2 className="text-lg font-bold text-slate-800">1. Thông tin cơ bản</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>Mã hàng</span>
              <input className={inputClass} value={form.productCode} onChange={(event) => updateField('productCode', event.target.value)} placeholder="Tự động" />
            </label>
            <label>
              <span className={labelClass}>Mã vạch</span>
              <input className={inputClass} value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className={labelClass}>Tên hàng *</span>
              <input className={`${inputClass} ${fieldErrors.name ? 'border-[#b42318] ring-2 ring-[#b42318]/20' : ''}`} required value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <FieldError message={fieldErrors.name} />
            </label>
            <label>
              <span className={labelClass}>Nhóm hàng *</span>
              <select className={`${inputClass} ${fieldErrors.categoryId ? 'border-[#b42318] ring-2 ring-[#b42318]/20' : ''}`} value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)}>
                <option value="">Chọn nhóm hàng</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.isActive === false || category.isDeleted ? `${category.name} (đã ẩn)` : category.name}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.categoryId} />
            </label>
            <label>
              <span className={labelClass}>Thương hiệu</span>
              <select className={inputClass} value={form.brandName} onChange={(event) => updateField('brandName', event.target.value)}>
                <option value="">Không có thương hiệu</option>
                <option value="Hương Vân Trà">Hương Vân Trà</option>
                <option value="OEM">OEM</option>
                <option value="Khác">Khác</option>
              </select>
            </label>
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
          <h2 className="text-lg font-bold text-slate-800">2. Giá & Tồn kho mặc định</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label>
              <span className={labelClass}>Giá vốn</span>
              <input type="number" min="0" className={inputClass} value={form.costPrice} onChange={(event) => updateField('costPrice', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Giá bán</span>
              <input type="number" min="0" className={inputClass} value={form.salePrice} onChange={(event) => updateField('salePrice', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Tồn kho</span>
              <input type="number" disabled className={inputClass} value={form.stockQuantity} onChange={(event) => updateField('stockQuantity', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Định mức tồn thấp nhất</span>
              <input type="number" min="0" className={inputClass} value={form.minStock} onChange={(event) => updateField('minStock', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Định mức tồn cao nhất</span>
              <input type="number" min="0" className={inputClass} value={form.maxStock} onChange={(event) => updateField('maxStock', event.target.value)} />
            </label>
            <div>
              <span className={labelClass}>Trọng lượng</span>
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.weightValue} onChange={(event) => updateField('weightValue', event.target.value)} />
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]" value={form.weightUnit} onChange={(event) => updateField('weightUnit', event.target.value)}>
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
              <h2 className="text-lg font-bold text-slate-800">3. Quản lý đơn vị tính</h2>
              <p className="text-sm text-slate-500">Dòng đầu là đơn vị cơ bản, các dòng sau là đơn vị quy đổi như thùng, lốc, hộp.</p>
            </div>
            <button type="button" onClick={addUnit} className="rounded-xl border border-[#356647]/30 px-4 py-2 text-sm font-bold text-[#356647] hover:bg-[#f0eee6]">
              + Thêm đơn vị
            </button>
          </div>
          <FieldError message={fieldErrors.units} />
          <div className="mt-4 space-y-3">
            {form.units.map((unit, index) => (
              <div key={unit.id} className="grid gap-3 rounded-xl border border-slate-100 bg-[#fbf9f1] p-3 md:grid-cols-[1fr_140px_160px_150px_auto]">
                <label>
                  <span className="text-xs font-semibold text-slate-500">{unit.isBaseUnit ? 'Tên đơn vị cơ bản' : 'Tên đơn vị'}</span>
                  <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder={unit.isBaseUnit ? 'VD: cái' : 'VD: thùng'} value={unit.unitName} onChange={(event) => updateUnit(index, 'unitName', event.target.value)} />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-500">Quy đổi</span>
                  <input type="number" min="1" disabled={unit.isBaseUnit} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100" value={unit.conversionRate} onChange={(event) => updateUnit(index, 'conversionRate', event.target.value)} />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-500">Giá bán</span>
                  <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={unit.price} onChange={(event) => updateUnit(index, 'price', event.target.value)} />
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
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={unit.isDirectSell} onChange={(event) => updateUnit(index, 'isDirectSell', event.target.checked)} />
                    Bán trực tiếp
                  </label>
                  {!unit.isBaseUnit ? (
                    <button type="button" className="text-left text-xs font-bold text-[#b42318]" onClick={() => removeUnit(index)}>
                      Xóa
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">4. Thuộc tính</h2>
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
                  <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={attribute.name} onChange={(event) => updateAttribute(index, 'name', event.target.value)}>
                    <option value="">Chọn tên thuộc tính</option>
                    {ATTRIBUTE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
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

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">5. Hàng cùng loại</h2>
              <p className="text-sm text-slate-500">Bảng sinh từ Đơn vị tính × Thuộc tính. Giá vốn = Giá vốn mặc định × Quy đổi.</p>
            </div>
            <span className="rounded-full bg-[#f0eee6] px-3 py-1 text-sm font-bold text-slate-700">{generatedRows.length} dòng</span>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Đơn vị</th>
                  <th className="px-3 py-3">Thuộc tính</th>
                  <th className="px-3 py-3">Quy đổi</th>
                  <th className="px-3 py-3">Mã hàng</th>
                  <th className="px-3 py-3">Mã vạch</th>
                  <th className="px-3 py-3">Giá vốn</th>
                  <th className="px-3 py-3">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generatedRows.map((row) => (
                  <tr key={row.key} className="hover:bg-[#fbf9f1]">
                    <td className="px-3 py-3 font-bold text-[#356647]">{row.unit.unitName}</td>
                    <td className="px-3 py-3">
                      {row.attributes.length ? (
                        <div className="flex flex-wrap gap-1">
                          {row.attributes.map((attribute) => (
                            <span key={`${row.key}-${attribute.name}-${attribute.value}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {attribute.name}: {attribute.value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Không có</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{row.unit.conversionRate}</td>
                    <td className="px-3 py-3">
                      <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm" placeholder="Tự động" value={row.skuCode} onChange={(event) => updateVariantDraft(row.key, 'skuCode', event.target.value)} />
                    </td>
                    <td className="px-3 py-3">
                      <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={row.barcode} onChange={(event) => updateVariantDraft(row.key, 'barcode', event.target.value)} />
                    </td>
                    <td className="px-3 py-3">
                      <input readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 font-semibold text-slate-600" value={formatCurrency(row.costPrice)} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" min="0" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={row.salePrice} onChange={(event) => updateVariantDraft(row.key, 'salePrice', event.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {isEditMode && id ? (
          <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <ProductSkusPanel productId={id} canManage={canEdit} canAdjustStock={canAdjustStock} warehouseStockView={canEdit} layout="column" />
          </section>
        ) : null}
      </form>
    </PageShell>
  )
}

export default ProductFormPage
