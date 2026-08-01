import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  formatVietnamDateTimeMinute,
  fromDatetimeLocalToUtc,
  toDatetimeLocalValue,
} from '../../../utils/vietnamDateTime.js'
import {
  formatPromotionDiscountText,
  formatPromotionLabel,
} from '../../pos/utils/posPromotionUtils.js'
import { fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'
import { fetchCategories } from '../../products/services/categoriesApi.js'
import {
  createAdminPromotion,
  deactivateAdminPromotion,
  fetchAdminPromotions,
  reactivateAdminPromotion,
  updateAdminPromotion,
} from '../services/promotionsAdminApi.js'
import { fetchAdminMembershipTiers } from '../services/tiersAdminApi.js'

const EMPTY_FORM = {
  promoCode: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minimumOrderAmount: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '1',
  validFrom: '',
  validTo: '',
  isActive: true,
  scopeType: 'ORDER',
  skuScopes: [],
  categoryScopes: [],
  customerTierMode: 'ALL',
  customerTierScopes: [],
}

const MAX_PERCENTAGE_DISCOUNT_VALUE = 90
const MAX_FIXED_DISCOUNT_VALUE = 10000000
const MAX_PERCENTAGE_DISCOUNT_AMOUNT = 10000000
const MAX_MINIMUM_ORDER_AMOUNT = 100000000
const MAX_USAGE_LIMIT = 1000000
const PROMOTION_PAGE_SIZE = 10
const PROMO_CODE_REGEX = /^[A-Z0-9_-]+$/
const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: PROMOTION_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
}

const VALIDITY_BADGE_CLASS = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPIRED: 'bg-red-50 text-red-600 border-red-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-300',
}

const VALIDITY_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Tạm tắt',
  SCHEDULED: 'Sắp diễn ra',
  EXPIRED: 'Hết hạn',
}

function getAdminPromotionValidityLabel(status) {
  return VALIDITY_LABELS[status] ?? status
}

function formatPromotionPeriod(promotion) {
  const from = promotion.validFromUtc ? formatVietnamDateTimeMinute(promotion.validFromUtc) : null
  const to = promotion.validToUtc ? formatVietnamDateTimeMinute(promotion.validToUtc) : null

  if (from && to) return `${from} → ${to}`
  if (from) return `Từ ${from}`
  if (to) return `Đến ${to}`
  return 'Không giới hạn'
}

function formatDatetimeLocal(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getCurrentDatetimeLocalMinute() {
  return formatDatetimeLocal(new Date())
}

function isDatetimeLocalBeforeCurrentMinute(value) {
  if (!value) return false
  const selected = new Date(value)
  if (Number.isNaN(selected.getTime())) return false

  const current = new Date()
  current.setSeconds(0, 0)
  return selected < current
}

function addMinutesToDatetimeLocal(value, minutes) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() + minutes)
  return formatDatetimeLocal(date)
}

function formatCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('vi-VN')
}

function parseCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatIntegerInput(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function parseIntegerInput(value) {
  const digits = formatIntegerInput(value)
  return digits ? Number(digits) : 0
}

function getDiscountValueMax(discountType) {
  return discountType === 'PERCENTAGE'
    ? MAX_PERCENTAGE_DISCOUNT_VALUE
    : MAX_FIXED_DISCOUNT_VALUE
}

function getDiscountValueHelperText(discountType) {
  return discountType === 'PERCENTAGE'
    ? 'Với giảm phần trăm: tối đa 90%.'
    : 'Với giảm cố định: tối đa 10.000.000đ.'
}

function formatPromotionMinimumOrderSummary(promotion) {
  const amount = Number(promotion?.minimumOrderAmount || 0)
  return amount > 0 ? `Từ ${amount.toLocaleString('vi-VN')}đ` : 'Không yêu cầu'
}

function formatPromotionUsageSummary(promotion) {
  const totalLimit = Number(promotion?.usageLimitTotal || 0)
  const perCustomerLimit = Number(promotion?.usageLimitPerCustomer || 0)
  const used = Number(promotion?.usedCountTotal ?? promotion?.orderCount ?? 0)
  const lines = [
    totalLimit > 0
      ? `Đã dùng ${used.toLocaleString('vi-VN')} / ${totalLimit.toLocaleString('vi-VN')}`
      : 'Không giới hạn',
  ]

  if (perCustomerLimit > 0) {
    lines.push(`Mỗi khách: ${perCustomerLimit.toLocaleString('vi-VN')} lần`)
  }

  return lines
}

function formatAdminPromotionScopeSummary(promotion) {
  const scopeType = String(promotion?.scopeType || 'ORDER').toUpperCase()
  if (scopeType === 'ORDER') return 'Toàn đơn'

  if (scopeType === 'CATEGORY') {
    const scopes = Array.isArray(promotion.categoryScopes) ? promotion.categoryScopes : []
    if (!scopes.length) return 'Theo danh mục'
    return `Danh mục: ${scopes
      .map((scope) => scope.categoryName || scope.categorySnapshotName || scope.categoryId)
      .filter(Boolean)
      .join(', ')}`
  }

  const scopes = Array.isArray(promotion.skuScopes) ? promotion.skuScopes : []
  if (!scopes.length) return 'SKU cụ thể'
  return `SKU: ${scopes
    .map((scope) => scope.skuCode || scope.skuName || scope.skuId)
    .filter(Boolean)
    .join(', ')}`
}

function getSkuDisplayName(sku) {
  if (!sku) return ''
  const name = [sku.productName, sku.packagingType].filter(Boolean).join(' - ')
  return name || sku.skuCode || sku.id
}

function mapSkuToPromotionScope(sku) {
  return {
    skuId: sku.id,
    skuCode: sku.skuCode || '',
    skuName: getSkuDisplayName(sku),
  }
}

function getCategoryDisplayName(category) {
  if (!category) return ''
  return category.name || category.categoryName || category.categorySnapshotName || `#${category.id}`
}

function mapCategoryToPromotionScope(category) {
  return {
    categoryId: category.id,
    categoryName: getCategoryDisplayName(category),
  }
}

function getCustomerTierDisplayName(tier) {
  if (!tier) return ''
  return tier.tierName || tier.tierCode || `Hạng #${tier.id}`
}

function mapCustomerTierToPromotionScope(tier) {
  return {
    tierId: Number(tier.id),
    tierName: getCustomerTierDisplayName(tier),
  }
}

function formatPromotionCustomerTierSummary(promotion) {
  const scopes = Array.isArray(promotion?.customerTierScopes)
    ? promotion.customerTierScopes
    : []
  if (!scopes.length) return 'Hạng KH: Tất cả'

  return `Hạng KH: ${scopes
    .map((scope) => scope.tierName || scope.tierSnapshotName || `Hạng #${scope.tierId}`)
    .filter(Boolean)
    .join(', ')}`
}

function formatSelectedCustomerTierSummary(scopes = []) {
  if (!scopes.length) return 'Tất cả hạng khách hàng'

  const names = scopes
    .map((scope) => scope.tierName || scope.tierSnapshotName || `Hạng #${scope.tierId}`)
    .filter(Boolean)

  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

function PromotionsPage() {
  const [promotions, setPromotions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewPromotion, setViewPromotion] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingOrderCount, setEditingOrderCount] = useState(0)
  const [editingOriginalValidity, setEditingOriginalValidity] = useState({ validFrom: '', validTo: '' })
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [skuOptions, setSkuOptions] = useState([])
  const [isSkuLoading, setIsSkuLoading] = useState(false)
  const [skuSearchTerm, setSkuSearchTerm] = useState('')
  const [categoryOptions, setCategoryOptions] = useState([])
  const [isCategoryLoading, setIsCategoryLoading] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [customerTierOptions, setCustomerTierOptions] = useState([])
  const [isCustomerTierLoading, setIsCustomerTierLoading] = useState(false)
  const [customerTierSearchTerm, setCustomerTierSearchTerm] = useState('')
  const [promotionSearchTerm, setPromotionSearchTerm] = useState('')
  const [discountTypeFilter, setDiscountTypeFilter] = useState('ALL')
  const [scopeTypeFilter, setScopeTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PROMOTION_PAGE_SIZE)
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchAdminPromotions({
        page,
        pageSize,
        search: promotionSearchTerm,
        discountType: discountTypeFilter,
        scopeType: scopeTypeFilter,
        status: statusFilter,
      })
      setPromotions(result.items)
      setPagination({
        page: result.page || page,
        pageSize: result.pageSize || pageSize,
        totalItems: result.totalItems || 0,
        totalPages: Math.max(1, result.totalPages || 1),
      })
    } catch (error) {
      setPromotions([])
      setPagination(DEFAULT_PAGINATION)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [discountTypeFilter, page, pageSize, promotionSearchTerm, scopeTypeFilter, statusFilter])

  const loadSkuOptions = useCallback(async () => {
    if (skuOptions.length > 0 || isSkuLoading) return

    setIsSkuLoading(true)
    try {
      const items = await fetchAllActiveStoreSkus(100)
      setSkuOptions(items)
    } catch (error) {
      setSkuOptions([])
      showError(error.message)
    } finally {
      setIsSkuLoading(false)
    }
  }, [isSkuLoading, skuOptions.length])

  const loadCategoryOptions = useCallback(async () => {
    if (categoryOptions.length > 0 || isCategoryLoading) return

    setIsCategoryLoading(true)
    try {
      const items = await fetchCategories()
      setCategoryOptions(items.filter((category) => !category.isDeleted && category.isActive !== false))
    } catch (error) {
      setCategoryOptions([])
      showError(error.message)
    } finally {
      setIsCategoryLoading(false)
    }
  }, [categoryOptions.length, isCategoryLoading])

  const loadCustomerTierOptions = useCallback(async () => {
    if (customerTierOptions.length > 0 || isCustomerTierLoading) return

    setIsCustomerTierLoading(true)
    try {
      const items = await fetchAdminMembershipTiers()
      setCustomerTierOptions(items.filter((tier) => tier.isActive !== false))
    } catch (error) {
      setCustomerTierOptions([])
      showError(error.message)
    } finally {
      setIsCustomerTierLoading(false)
    }
  }, [customerTierOptions.length, isCustomerTierLoading])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreate = () => {
    setEditingId(null)
    setEditingOrderCount(0)
    setEditingOriginalValidity({ validFrom: '', validTo: '' })
    setForm({ ...EMPTY_FORM, skuScopes: [], categoryScopes: [], customerTierScopes: [] })
    setSkuSearchTerm('')
    setCategorySearchTerm('')
    setCustomerTierSearchTerm('')
    loadSkuOptions()
    loadCustomerTierOptions()
    setModalOpen(true)
  }

  const openEdit = (promotion) => {
    setEditingId(promotion.id)
    setEditingOrderCount(Number(promotion.orderCount || 0))
    const validFrom = promotion.validFromUtc ? toDatetimeLocalValue(promotion.validFromUtc) : ''
    const validTo = promotion.validToUtc ? toDatetimeLocalValue(promotion.validToUtc) : ''
    const customerTierScopes = Array.isArray(promotion.customerTierScopes)
      ? promotion.customerTierScopes
      : []
    setEditingOriginalValidity({ validFrom, validTo })
    setForm({
      promoCode: promotion.promoCode,
      discountType: promotion.discountType,
      discountValue: promotion.discountType === 'FIXED'
        ? formatCurrencyInput(promotion.discountValue)
        : String(promotion.discountValue),
      maxDiscountAmount: Number(promotion.maxDiscountAmount || 0) > 0
        ? formatCurrencyInput(promotion.maxDiscountAmount)
        : '',
      minimumOrderAmount: Number(promotion.minimumOrderAmount || 0) > 0
        ? formatCurrencyInput(promotion.minimumOrderAmount)
        : '',
      usageLimitTotal: Number(promotion.usageLimitTotal || 0) > 0
        ? String(promotion.usageLimitTotal)
        : '',
      usageLimitPerCustomer: Number(promotion.usageLimitPerCustomer || 0) > 0
        ? String(promotion.usageLimitPerCustomer)
        : '',
      validFrom,
      validTo,
      isActive: promotion.isActive ?? true,
      scopeType: promotion.scopeType || 'ORDER',
      skuScopes: Array.isArray(promotion.skuScopes) ? promotion.skuScopes : [],
      categoryScopes: Array.isArray(promotion.categoryScopes) ? promotion.categoryScopes : [],
      customerTierMode: customerTierScopes.length > 0 ? 'SPECIFIC' : 'ALL',
      customerTierScopes,
    })
    setSkuSearchTerm('')
    setCategorySearchTerm('')
    setCustomerTierSearchTerm('')
    loadSkuOptions()
    loadCustomerTierOptions()
    if (String(promotion.scopeType || 'ORDER').toUpperCase() === 'CATEGORY') {
      loadCategoryOptions()
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    const promoCode = form.promoCode.trim().toUpperCase()
    if (!promoCode) {
      showError('Mã giảm giá là bắt buộc.')
      return
    }
    if (promoCode.length < 3 || promoCode.length > 50) {
      showError('Mã giảm giá phải có từ 3 đến 50 ký tự.')
      return
    }
    if (!PROMO_CODE_REGEX.test(promoCode)) {
      showError('Mã giảm giá chỉ được chứa chữ cái, số, dấu gạch ngang (-) hoặc gạch dưới (_).')
      return
    }

    if (form.validFrom && form.validTo && form.validTo <= form.validFrom) {
      showError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }
    const validFromChanged = !editingId || form.validFrom !== editingOriginalValidity.validFrom
    const validToChanged = !editingId || form.validTo !== editingOriginalValidity.validTo
    if (form.validFrom && validFromChanged && isDatetimeLocalBeforeCurrentMinute(form.validFrom)) {
      showError('Thời gian bắt đầu không được ở quá khứ.')
      return
    }
    if (form.validTo && validToChanged && isDatetimeLocalBeforeCurrentMinute(form.validTo)) {
      showError('Thời gian kết thúc không được ở quá khứ.')
      return
    }

    const scopeType = String(form.scopeType || 'ORDER').toUpperCase()
    const skuScopes = scopeType === 'SKU' ? form.skuScopes ?? [] : []
    const categoryScopes = scopeType === 'CATEGORY' ? form.categoryScopes ?? [] : []
    const customerTierScopes = form.customerTierMode === 'SPECIFIC'
      ? form.customerTierScopes ?? []
      : []
    const discountType = String(form.discountType || 'PERCENTAGE').toUpperCase()
    const discountValue = discountType === 'FIXED'
      ? parseCurrencyInput(form.discountValue)
      : Number(form.discountValue)
    const maxDiscountAmount = discountType === 'PERCENTAGE'
      ? parseCurrencyInput(form.maxDiscountAmount)
      : null
    const minimumOrderAmount = parseCurrencyInput(form.minimumOrderAmount)
    const usageLimitTotal = parseIntegerInput(form.usageLimitTotal)
    const usageLimitPerCustomer = parseIntegerInput(form.usageLimitPerCustomer)

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      showError('Giá trị giảm phải lớn hơn 0.')
      return
    }
    if (scopeType === 'SKU' && skuScopes.length === 0) {
      showError('Vui lòng chọn ít nhất một sản phẩm áp dụng.')
      return
    }
    if (scopeType === 'CATEGORY' && categoryScopes.length === 0) {
      showError('Vui lòng chọn ít nhất một danh mục áp dụng mã giảm giá.')
      return
    }
    if (customerTierScopes.some((scope) => Number(scope.tierId) <= 0)) {
      showError('Hạng khách hàng áp dụng không hợp lệ.')
      return
    }
    if (form.customerTierMode === 'SPECIFIC' && customerTierScopes.length === 0) {
      showError('Vui lòng chọn ít nhất một hạng khách hàng áp dụng.')
      return
    }

    if (discountType === 'PERCENTAGE') {
      if (discountValue > MAX_PERCENTAGE_DISCOUNT_VALUE) {
        showError('Mã giảm phần trăm không được vượt quá 90%.')
        return
      }
      if (maxDiscountAmount <= 0) {
        showError('Mã giảm phần trăm cần có số tiền giảm tối đa.')
        return
      }
      if (maxDiscountAmount > MAX_PERCENTAGE_DISCOUNT_AMOUNT) {
        showError('Số tiền giảm tối đa không được vượt quá 10.000.000đ.')
        return
      }
    }

    if (discountType === 'FIXED') {
      if (discountValue > MAX_FIXED_DISCOUNT_VALUE) {
        showError('Mã giảm cố định không được vượt quá 10.000.000đ.')
        return
      }
      if (minimumOrderAmount <= 0) {
        showError('Mã giảm cố định cần có đơn tối thiểu lớn hơn 0đ.')
        return
      }
      if (discountValue > minimumOrderAmount) {
        showError('Số tiền giảm cố định không được lớn hơn đơn tối thiểu.')
        return
      }
    }

    if (minimumOrderAmount < 0 || minimumOrderAmount > MAX_MINIMUM_ORDER_AMOUNT) {
      showError('Đơn tối thiểu không được vượt quá 100.000.000đ.')
      return
    }

    if (usageLimitTotal < 0 || usageLimitTotal > MAX_USAGE_LIMIT) {
      showError('Giới hạn tổng lượt dùng không hợp lệ.')
      return
    }

    if (usageLimitPerCustomer < 0 || usageLimitPerCustomer > MAX_USAGE_LIMIT) {
      showError('Giới hạn lượt dùng mỗi khách không hợp lệ.')
      return
    }

    if (usageLimitTotal > 0 && usageLimitPerCustomer > usageLimitTotal) {
      showError('Giới hạn lượt dùng mỗi khách không được lớn hơn tổng lượt dùng.')
      return
    }

    const payload = {
      promoCode,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      usageLimitTotal,
      usageLimitPerCustomer,
      validFrom: fromDatetimeLocalToUtc(form.validFrom),
      validTo: fromDatetimeLocalToUtc(form.validTo),
      isActive: form.isActive,
      scopeType,
      skuScopes,
      categoryScopes,
      customerTierScopes,
    }

    if (payload.validFrom && payload.validTo && payload.validFrom > payload.validTo) {
      showError('Ngày bắt đầu không được sau ngày kết thúc.')
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateAdminPromotion(editingId, payload)
        showSuccess('Đã cập nhật mã giảm giá.')
      } else {
        await createAdminPromotion(payload)
        showSuccess('Đã thêm mã giảm giá.')
      }
      setModalOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeactivate = async (promotion) => {
    if (promotion.canToggleActive === false) {
      showError('Mã giảm giá đã hết hạn. Vui lòng gia hạn thời gian sử dụng trước khi kích hoạt lại.')
      return
    }
    if (!(await confirmDialog({
      title: 'Ngừng hoạt động',
      message: `Ngừng hoạt động mã "${promotion.promoCode}"?`,
      tone: 'danger',
    }))) return
    try {
      await deactivateAdminPromotion(promotion.id)
      showSuccess('Đã ngừng hoạt động mã giảm giá.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleReactivate = async (promotion) => {
    if (promotion.canToggleActive === false) {
      showError('Mã giảm giá đã hết hạn. Vui lòng gia hạn thời gian sử dụng trước khi kích hoạt lại.')
      return
    }
    try {
      await reactivateAdminPromotion(promotion.id)
      showSuccess('Đã kích hoạt lại mã giảm giá.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const normalizedPromotionSearch = promotionSearchTerm.trim().toLowerCase()
  const hasActivePromotionFilter =
    Boolean(normalizedPromotionSearch) ||
    discountTypeFilter !== 'ALL' ||
    scopeTypeFilter !== 'ALL' ||
    statusFilter !== 'ALL'
  const isImmutableLocked = editingOrderCount > 0
  const selectedSkuIds = new Set((form.skuScopes ?? []).map((scope) => scope.skuId))
  const selectedCategoryIds = new Set((form.categoryScopes ?? []).map((scope) => Number(scope.categoryId)))
  const selectedCustomerTierIds = new Set((form.customerTierScopes ?? []).map((scope) => Number(scope.tierId)))
  const displaySkuOptions = [
    ...skuOptions,
    ...(form.skuScopes ?? [])
      .filter((scope) => scope.skuId && !skuOptions.some((sku) => sku.id === scope.skuId))
      .map((scope) => ({
        id: scope.skuId,
        skuCode: scope.skuCode || '',
        productName: scope.skuName || '',
        packagingType: '',
      })),
  ]
  const normalizedSkuSearch = skuSearchTerm.trim().toLowerCase()
  const visibleSkuOptions = displaySkuOptions
    .filter((sku) => {
      if (!normalizedSkuSearch) return true
      return [
        sku.skuCode,
        sku.productName,
        sku.packagingType,
        getSkuDisplayName(sku),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSkuSearch))
    })
    .slice(0, 12)
  const selectedSkuScopes = form.skuScopes ?? []
  const displayCategoryOptions = [
    ...categoryOptions,
    ...(form.categoryScopes ?? [])
      .filter((scope) => scope.categoryId && !categoryOptions.some((category) => Number(category.id) === Number(scope.categoryId)))
      .map((scope) => ({
        id: scope.categoryId,
        name: scope.categoryName || scope.categorySnapshotName || '',
      })),
  ]
  const normalizedCategorySearch = categorySearchTerm.trim().toLowerCase()
  const visibleCategoryOptions = displayCategoryOptions
    .filter((category) => {
      if (!normalizedCategorySearch) return true
      return [
        category.name,
        category.categoryName,
        category.description,
        category.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedCategorySearch))
    })
    .slice(0, 12)
  const selectedCategoryScopes = form.categoryScopes ?? []
  const displayCustomerTierOptions = [
    ...customerTierOptions,
    ...(form.customerTierScopes ?? [])
      .filter((scope) => scope.tierId && !customerTierOptions.some((tier) => Number(tier.id) === Number(scope.tierId)))
      .map((scope) => ({
        id: scope.tierId,
        tierCode: scope.tierName || scope.tierSnapshotName || `Hạng #${scope.tierId}`,
      })),
  ]
  const normalizedCustomerTierSearch = customerTierSearchTerm.trim().toLowerCase()
  const visibleCustomerTierOptions = displayCustomerTierOptions
    .filter((tier) => {
      if (!normalizedCustomerTierSearch) return true
      return [
        tier.tierCode,
        tier.tierName,
        tier.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedCustomerTierSearch))
    })
    .slice(0, 12)
  const selectedCustomerTierScopes = form.customerTierScopes ?? []
  const addSkuScope = (sku) => {
    if (isImmutableLocked || selectedSkuIds.has(sku.id)) return
    setForm((prev) => ({
      ...prev,
      skuScopes: [...(prev.skuScopes ?? []), mapSkuToPromotionScope(sku)],
    }))
  }
  const removeSkuScope = (skuId) => {
    if (isImmutableLocked) return
    setForm((prev) => ({
      ...prev,
      skuScopes: (prev.skuScopes ?? []).filter((scope) => scope.skuId !== skuId),
    }))
  }
  const addCategoryScope = (category) => {
    const categoryId = Number(category.id)
    if (isImmutableLocked || !categoryId || selectedCategoryIds.has(categoryId)) return
    setForm((prev) => ({
      ...prev,
      categoryScopes: [...(prev.categoryScopes ?? []), mapCategoryToPromotionScope(category)],
    }))
  }
  const removeCategoryScope = (categoryId) => {
    if (isImmutableLocked) return
    setForm((prev) => ({
      ...prev,
      categoryScopes: (prev.categoryScopes ?? []).filter((scope) => Number(scope.categoryId) !== Number(categoryId)),
    }))
  }
  const addCustomerTierScope = (tier) => {
    const tierId = Number(tier.id)
    if (isImmutableLocked || !tierId || selectedCustomerTierIds.has(tierId)) return
    setForm((prev) => ({
      ...prev,
      customerTierScopes: [...(prev.customerTierScopes ?? []), mapCustomerTierToPromotionScope(tier)],
    }))
  }
  const removeCustomerTierScope = (tierId) => {
    if (isImmutableLocked) return
    setForm((prev) => ({
      ...prev,
      customerTierScopes: (prev.customerTierScopes ?? []).filter((scope) => Number(scope.tierId) !== Number(tierId)),
    }))
  }
  return (
    <PageShell>
      <PageHeader
        title="Quản lý mã giảm giá"
        titleInfo="Tạo và chỉnh sửa mã khuyến mãi dùng tại POS và trên đơn hàng"
        rightContent={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Thêm mã
          </button>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <input
          type="search"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          placeholder="Tìm kiếm mã giảm giá..."
          value={promotionSearchTerm}
          onChange={(e) => {
            setPromotionSearchTerm(e.target.value)
            setPage(1)
          }}
        />
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          value={discountTypeFilter}
          onChange={(e) => {
            setDiscountTypeFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="ALL">Tất cả loại giảm</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          value={scopeTypeFilter}
          onChange={(e) => {
            setScopeTypeFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="ALL">Tất cả phạm vi</option>
          <option value="ORDER">Toàn đơn</option>
          <option value="SKU">SKU cụ thể</option>
          <option value="CATEGORY">Theo danh mục</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Tạm tắt</option>
          <option value="SCHEDULED">Sắp diễn ra</option>
          <option value="EXPIRED">Hết hạn</option>
        </select>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã</th>
                <th className="px-4 py-4">Giảm giá</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={4}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && promotions.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={4}>
                    {hasActivePromotionFilter
                      ? 'Không tìm thấy mã giảm giá phù hợp.'
                      : 'Chưa có mã giảm giá. Bấm "Thêm mã" để tạo.'}
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? promotions.map((promotion) => {
                    const status = String(promotion.validityStatus || (promotion.isActive ? 'ACTIVE' : 'INACTIVE')).toUpperCase()
                    const badgeClass = VALIDITY_BADGE_CLASS[status] ?? VALIDITY_BADGE_CLASS.INACTIVE
                    const canToggleActive = promotion.canToggleActive !== false

                    return (
                      <tr key={promotion.id} className={`hover:bg-[#fbf9f1]/30 ${promotion.isEffectivelyActive === false ? 'opacity-60' : ''}`}>
                        <td className="px-8 py-5 font-bold text-slate-800">{promotion.promoCode}</td>
                        <td className="px-4 py-5 text-slate-700">
                          {formatPromotionDiscountText(promotion)}
                        </td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                            {getAdminPromotionValidityLabel(status)}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setViewPromotion(promotion)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Sửa
                            </button>
                            {!canToggleActive ? (
                              <button
                                type="button"
                                disabled
                                title="Mã đã hết hạn, hãy gia hạn thời gian sử dụng để kích hoạt lại."
                                className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400"
                              >
                                Hết hạn
                              </button>
                            ) : promotion.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(promotion)}
                                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              >
                                Ngừng HĐ
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(promotion)}
                                className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Kích hoạt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={pagination.totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={isLoading}
          itemLabel="mã giảm giá"
        />
      </div>

      {viewPromotion ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setViewPromotion(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chi tiết mã giảm giá</p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">{viewPromotion.promoCode}</h2>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setViewPromotion(null)}
                title="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <dl className="mt-5 space-y-3">
              {[
                ['Giảm giá', formatPromotionDiscountText(viewPromotion)],
                [
                  'Loại',
                  String(viewPromotion.discountType || '').toUpperCase() === 'FIXED'
                    ? 'Giảm số tiền cố định'
                    : 'Giảm theo phần trăm',
                ],
                ['Đơn tối thiểu', formatPromotionMinimumOrderSummary(viewPromotion)],
                ['Thời hạn', formatPromotionPeriod(viewPromotion)],
                ['Phạm vi', formatAdminPromotionScopeSummary(viewPromotion)],
                ['Hạng khách hàng', formatPromotionCustomerTierSummary(viewPromotion)],
                ['Mô tả', formatPromotionLabel(viewPromotion)],
                ['Lượt dùng', formatPromotionUsageSummary(viewPromotion).join(' · ')],
                [
                  'Trạng thái',
                  getAdminPromotionValidityLabel(
                    String(viewPromotion.validityStatus || (viewPromotion.isActive ? 'ACTIVE' : 'INACTIVE')).toUpperCase(),
                  ),
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#fbf9f1] px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewPromotion(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const promotion = viewPromotion
                  setViewPromotion(null)
                  openEdit(promotion)
                }}
                className="rounded-lg bg-[#538463] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Sửa mã
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá'}
            </h2>
            <div className="mt-4 space-y-3">
              {editingOrderCount > 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Mã đã dùng trên {editingOrderCount} đơn. Chỉ có thể chỉnh thời hạn hoặc ngừng hoạt động.
                </p>
              ) : null}
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Mã</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.promoCode}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
                  placeholder="VD: SALE10"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Từ 3 đến 50 ký tự, chỉ dùng chữ cái, số, dấu gạch ngang (-) hoặc gạch dưới (_).
                </p>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Loại giảm</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.discountType}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => {
                    const nextType = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      discountType: nextType,
                      discountValue: nextType === 'FIXED'
                        ? formatCurrencyInput(prev.discountValue)
                        : String(parseCurrencyInput(prev.discountValue) || ''),
                      maxDiscountAmount: nextType === 'PERCENTAGE'
                        ? prev.maxDiscountAmount
                        : '',
                    }))
                  }}
                >
                  <option value="PERCENTAGE">PERCENTAGE — giảm theo %</option>
                  <option value="FIXED">FIXED — giảm số tiền cố định</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  PERCENTAGE cần cấu hình giảm tối đa. FIXED cần cấu hình đơn tối thiểu.
                </p>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Giá trị {form.discountType === 'FIXED' ? '(đ)' : '(%)'}
                </span>
                <input
                  type={form.discountType === 'FIXED' ? 'text' : 'number'}
                  inputMode={form.discountType === 'FIXED' ? 'numeric' : undefined}
                  min={0}
                  max={form.discountType === 'PERCENTAGE' ? getDiscountValueMax(form.discountType) : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.discountValue}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    discountValue: form.discountType === 'FIXED'
                      ? formatCurrencyInput(e.target.value)
                      : e.target.value,
                  }))}
                />
                <p className="mt-1 text-xs text-slate-500">{getDiscountValueHelperText(form.discountType)}</p>
              </label>
              {form.discountType === 'PERCENTAGE' ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Giảm tối đa</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={form.maxDiscountAmount}
                    disabled={editingOrderCount > 0}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      maxDiscountAmount: formatCurrencyInput(e.target.value),
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Bắt buộc với mã giảm phần trăm. Tối đa 10.000.000đ.
                  </p>
                </label>
              ) : null}
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Đơn tối thiểu</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.minimumOrderAmount}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    minimumOrderAmount: formatCurrencyInput(e.target.value),
                  }))}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {form.discountType === 'FIXED'
                    ? 'Bắt buộc với mã giảm cố định, phải lớn hơn 0 và không vượt quá 100.000.000đ.'
                    : 'Để trống hoặc 0 nếu không yêu cầu đơn tối thiểu. Tối đa 100.000.000đ.'}
                </p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Giới hạn tổng lượt dùng</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={form.usageLimitTotal}
                    disabled={editingOrderCount > 0}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      usageLimitTotal: formatIntegerInput(e.target.value),
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Để trống hoặc 0 nếu không giới hạn tổng lượt dùng.
                  </p>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Giới hạn mỗi khách</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={form.usageLimitPerCustomer}
                    disabled={editingOrderCount > 0}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      usageLimitPerCustomer: formatIntegerInput(e.target.value),
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Mặc định 1 lần/khách. Nhập 0 nếu không giới hạn theo từng khách hàng.
                  </p>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Phạm vi áp dụng</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.scopeType}
                  disabled={isImmutableLocked}
                  onChange={(e) => {
                    if (e.target.value === 'SKU') loadSkuOptions()
                    if (e.target.value === 'CATEGORY') loadCategoryOptions()
                    setForm((prev) => ({
                      ...prev,
                      scopeType: e.target.value,
                      skuScopes: e.target.value === 'SKU' ? prev.skuScopes : [],
                      categoryScopes: e.target.value === 'CATEGORY' ? prev.categoryScopes : [],
                    }))
                  }}
                >
                  <option value="ORDER">Toàn đơn</option>
                  <option value="SKU">SKU cụ thể</option>
                  <option value="CATEGORY">Theo danh mục</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  ORDER áp dụng toàn đơn. SKU hoặc CATEGORY cần chọn ít nhất một đối tượng áp dụng.
                </p>
              </label>
              {form.scopeType === 'SKU' ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400">SKU áp dụng</span>
                    <span className="text-xs text-slate-500">{selectedSkuIds.size} đã chọn</span>
                  </div>
                  <input
                    type="text"
                    className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Nhập mã SKU hoặc tên sản phẩm..."
                    value={skuSearchTerm}
                    disabled={isImmutableLocked}
                    onChange={(e) => setSkuSearchTerm(e.target.value)}
                  />
                  {selectedSkuScopes.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedSkuScopes.map((scope) => (
                        <span
                          key={scope.skuId}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#538463]/20 bg-[#538463]/10 px-2.5 py-1 text-xs font-semibold text-[#356647]"
                        >
                          <span className="truncate">{scope.skuCode || scope.skuName || scope.skuId}</span>
                          {!isImmutableLocked ? (
                            <button
                              type="button"
                              className="text-[#356647] hover:text-red-600"
                              onClick={() => removeSkuScope(scope.skuId)}
                              aria-label={`Gỡ ${scope.skuCode || scope.skuName || scope.skuId}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-slate-500">Chưa chọn SKU nào.</p>
                  )}
                  {isSkuLoading ? (
                    <p className="text-xs text-slate-500">Đang tải SKU...</p>
                  ) : null}
                  {!isSkuLoading && displaySkuOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">Không có SKU khả dụng.</p>
                  ) : null}
                  {!isSkuLoading && displaySkuOptions.length > 0 ? (
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {visibleSkuOptions.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-500">Không tìm thấy SKU phù hợp.</p>
                      ) : null}
                      {visibleSkuOptions.map((sku) => {
                        const isSelected = selectedSkuIds.has(sku.id)
                        return (
                          <div
                            key={sku.id}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-slate-700">
                                {sku.skuCode || sku.id}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {getSkuDisplayName(sku)}
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={isImmutableLocked || isSelected}
                              onClick={() => addSkuScope(sku)}
                              className="shrink-0 rounded-lg border border-[#538463]/30 px-2.5 py-1 text-xs font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:border-slate-200 disabled:text-slate-400"
                            >
                              {isSelected ? 'Đã chọn' : 'Thêm'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {form.scopeType === 'CATEGORY' ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400">Danh mục áp dụng</span>
                    <span className="text-xs text-slate-500">{selectedCategoryIds.size} đã chọn</span>
                  </div>
                  <input
                    type="text"
                    className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Nhập tên danh mục..."
                    value={categorySearchTerm}
                    disabled={isImmutableLocked}
                    onFocus={loadCategoryOptions}
                    onChange={(e) => setCategorySearchTerm(e.target.value)}
                  />
                  {selectedCategoryScopes.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedCategoryScopes.map((scope) => (
                        <span
                          key={scope.categoryId}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#538463]/20 bg-[#538463]/10 px-2.5 py-1 text-xs font-semibold text-[#356647]"
                        >
                          <span className="truncate">{scope.categoryName || scope.categorySnapshotName || scope.categoryId}</span>
                          {!isImmutableLocked ? (
                            <button
                              type="button"
                              className="text-[#356647] hover:text-red-600"
                              onClick={() => removeCategoryScope(scope.categoryId)}
                              aria-label={`Gỡ ${scope.categoryName || scope.categorySnapshotName || scope.categoryId}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-slate-500">Chưa chọn danh mục nào.</p>
                  )}
                  {isCategoryLoading ? (
                    <p className="text-xs text-slate-500">Đang tải danh mục...</p>
                  ) : null}
                  {!isCategoryLoading && displayCategoryOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">Không có danh mục khả dụng.</p>
                  ) : null}
                  {!isCategoryLoading && displayCategoryOptions.length > 0 ? (
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {visibleCategoryOptions.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-500">Không tìm thấy danh mục phù hợp.</p>
                      ) : null}
                      {visibleCategoryOptions.map((category) => {
                        const categoryId = Number(category.id)
                        const isSelected = selectedCategoryIds.has(categoryId)
                        return (
                          <div
                            key={category.id}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-slate-700">
                                {getCategoryDisplayName(category)}
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={isImmutableLocked || isSelected}
                              onClick={() => addCategoryScope(category)}
                              className="shrink-0 rounded-lg border border-[#538463]/30 px-2.5 py-1 text-xs font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:border-slate-200 disabled:text-slate-400"
                            >
                              {isSelected ? 'Đã chọn' : 'Thêm'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-slate-400">Hạng khách hàng áp dụng</span>
                  <span className="text-xs text-slate-500">
                    {formatSelectedCustomerTierSummary(selectedCustomerTierScopes)}
                  </span>
                </div>
                <select
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.customerTierMode}
                  disabled={isImmutableLocked}
                  onChange={(e) => {
                    const nextMode = e.target.value
                    if (nextMode === 'SPECIFIC') loadCustomerTierOptions()
                    setForm((prev) => ({
                      ...prev,
                      customerTierMode: nextMode,
                      customerTierScopes: nextMode === 'SPECIFIC' ? prev.customerTierScopes : [],
                    }))
                  }}
                >
                  <option value="ALL">Tất cả hạng khách hàng</option>
                  <option value="SPECIFIC">Chọn hạng cụ thể</option>
                </select>
                <p className="mb-3 text-xs text-slate-500">
                  Mặc định áp dụng cho tất cả khách hàng. Chỉ chọn hạng cụ thể khi muốn giới hạn mã cho một nhóm khách hàng.
                </p>
                {form.customerTierMode === 'SPECIFIC' ? (
                  <>
                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Mã giới hạn theo hạng khách hàng chỉ áp dụng cho khách hàng đã đăng ký.
                    </p>
                    <input
                      type="text"
                      className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="Tìm hạng khách hàng..."
                      value={customerTierSearchTerm}
                      disabled={isImmutableLocked}
                      onFocus={loadCustomerTierOptions}
                      onChange={(e) => setCustomerTierSearchTerm(e.target.value)}
                    />
                    {selectedCustomerTierScopes.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {selectedCustomerTierScopes.map((scope) => (
                          <span
                            key={scope.tierId}
                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#538463]/20 bg-[#538463]/10 px-2.5 py-1 text-xs font-semibold text-[#356647]"
                          >
                            <span className="truncate">{scope.tierName || scope.tierSnapshotName || `Hạng #${scope.tierId}`}</span>
                            {!isImmutableLocked ? (
                              <button
                                type="button"
                                className="text-[#356647] hover:text-red-600"
                                onClick={() => removeCustomerTierScope(scope.tierId)}
                                aria-label={`Gỡ ${scope.tierName || scope.tierSnapshotName || scope.tierId}`}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-slate-500">Chưa chọn hạng khách hàng nào.</p>
                    )}
                    {isCustomerTierLoading ? (
                      <p className="text-xs text-slate-500">Đang tải hạng khách hàng...</p>
                    ) : null}
                    {!isCustomerTierLoading && displayCustomerTierOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">Không có hạng khách hàng khả dụng.</p>
                    ) : null}
                    {!isCustomerTierLoading && displayCustomerTierOptions.length > 0 ? (
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {visibleCustomerTierOptions.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-slate-500">Không tìm thấy hạng khách hàng phù hợp.</p>
                        ) : null}
                        {visibleCustomerTierOptions.map((tier) => {
                          const tierId = Number(tier.id)
                          const isSelected = selectedCustomerTierIds.has(tierId)
                          return (
                            <div
                              key={tier.id}
                              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-slate-700">
                                  {getCustomerTierDisplayName(tier)}
                                </span>
                                {Number(tier.discountPercent || 0) > 0 ? (
                                  <span className="block truncate text-xs text-slate-500">
                                    CK hạng {Number(tier.discountPercent).toLocaleString('vi-VN')}%
                                  </span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                disabled={isImmutableLocked || isSelected}
                                onClick={() => addCustomerTierScope(tier)}
                                className="shrink-0 rounded-lg border border-[#538463]/30 px-2.5 py-1 text-xs font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:border-slate-200 disabled:text-slate-400"
                              >
                                {isSelected ? 'Đã chọn' : 'Thêm'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase text-slate-400">Thời gian bắt đầu</span>
                  <input
                    type="datetime-local"
                    min={editingId ? undefined : getCurrentDatetimeLocalMinute()}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.validFrom}
                    onChange={(e) => {
                      const nextFrom = e.target.value
                      setForm((prev) => ({
                        ...prev,
                        validFrom: nextFrom,
                        validTo:
                          nextFrom && prev.validTo && prev.validTo <= nextFrom
                            ? addMinutesToDatetimeLocal(nextFrom, 1)
                            : prev.validTo,
                      }))
                    }}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase text-slate-400">Thời gian kết thúc</span>
                  <input
                    type="datetime-local"
                    min={form.validFrom ? addMinutesToDatetimeLocal(form.validFrom, 1) : undefined}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.validTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Để trống cả hai ô nếu mã không giới hạn thời gian. Thời gian bắt đầu/kết thúc không được chọn quá khứ; thời gian kết thúc phải sau thời gian bắt đầu.
              </p>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#538463] focus:ring-[#538463]"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Kích hoạt
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default PromotionsPage
