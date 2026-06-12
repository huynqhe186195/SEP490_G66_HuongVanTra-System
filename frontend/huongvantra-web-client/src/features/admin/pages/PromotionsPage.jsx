import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  formatVietnamDateTimeMinute,
  fromDatetimeLocalToUtc,
  toDatetimeLocalValue,
} from '../../../utils/vietnamDateTime.js'
import {
  formatPromotionDiscountText,
  formatPromotionLabel,
  formatPromotionScopeSummary,
  getPromotionValidityLabel,
} from '../../pos/utils/posPromotionUtils.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import {
  createAdminPromotion,
  deactivateAdminPromotion,
  fetchAdminPromotions,
  reactivateAdminPromotion,
  updateAdminPromotion,
} from '../services/promotionsAdminApi.js'

const EMPTY_FORM = {
  promoCode: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minimumOrderAmount: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '',
  validFrom: '',
  validTo: '',
  isActive: true,
  scopeType: 'ORDER',
  skuScopes: [],
}

const MAX_PERCENTAGE_DISCOUNT_VALUE = 90
const MAX_FIXED_DISCOUNT_VALUE = 10000000
const MAX_PERCENTAGE_DISCOUNT_AMOUNT = 10000000
const MAX_USAGE_LIMIT = 1000000
const PROMOTION_PAGE_SIZE = 10
const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: PROMOTION_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
}

function getPaginationItems(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1)
  const current = Math.min(total, Math.max(1, Number(currentPage) || 1))

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 'ellipsis-right']
  }

  if (current >= total - 2) {
    return ['ellipsis-left', total - 2, total - 1, total]
  }

  return ['ellipsis-left', current - 1, current, current + 1, 'ellipsis-right']
}

const VALIDITY_BADGE_CLASS = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_started: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
  unlimited: 'bg-slate-50 text-slate-600 border-slate-200',
  deactivated: 'bg-slate-100 text-slate-500 border-slate-300',
}

function formatPromotionPeriod(promotion) {
  const from = promotion.validFromUtc ? formatVietnamDateTimeMinute(promotion.validFromUtc) : null
  const to = promotion.validToUtc ? formatVietnamDateTimeMinute(promotion.validToUtc) : null

  if (from && to) return `${from} ÔåÆ ${to}`
  if (from) return `Tß╗½ ${from}`
  if (to) return `─Éß║┐n ${to}`
  return 'Kh├┤ng giß╗øi hß║ín'
}

function formatDatetimeLocal(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getCurrentDatetimeLocalMinute() {
  return formatDatetimeLocal(new Date())
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
    ? 'Tß╗æi ─æa 90%'
    : 'Tß╗æi ─æa 10.000.000─æ'
}

function formatPromotionMinimumOrderSummary(promotion) {
  const amount = Number(promotion?.minimumOrderAmount || 0)
  return amount > 0 ? `Tß╗½ ${amount.toLocaleString('vi-VN')}─æ` : 'Kh├┤ng y├¬u cß║ºu'
}

function formatPromotionUsageSummary(promotion) {
  const totalLimit = Number(promotion?.usageLimitTotal || 0)
  const perCustomerLimit = Number(promotion?.usageLimitPerCustomer || 0)
  const used = Number(promotion?.usedCountTotal ?? promotion?.orderCount ?? 0)
  const lines = [
    totalLimit > 0
      ? `─É├ú d├╣ng ${used.toLocaleString('vi-VN')} / ${totalLimit.toLocaleString('vi-VN')}`
      : 'Kh├┤ng giß╗øi hß║ín',
  ]

  if (perCustomerLimit > 0) {
    lines.push(`Mß╗ùi kh├ích: ${perCustomerLimit.toLocaleString('vi-VN')} lß║ºn`)
  }

  return lines
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

function PromotionsPage() {
  const [promotions, setPromotions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingOrderCount, setEditingOrderCount] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [skuOptions, setSkuOptions] = useState([])
  const [isSkuLoading, setIsSkuLoading] = useState(false)
  const [skuSearchTerm, setSkuSearchTerm] = useState('')
  const [promotionSearchTerm, setPromotionSearchTerm] = useState('')
  const [discountTypeFilter, setDiscountTypeFilter] = useState('ALL')
  const [scopeTypeFilter, setScopeTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [jumpPopoverKey, setJumpPopoverKey] = useState(null)
  const [jumpPageInput, setJumpPageInput] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchAdminPromotions({
        page,
        pageSize: PROMOTION_PAGE_SIZE,
        search: promotionSearchTerm,
        discountType: discountTypeFilter,
        scopeType: scopeTypeFilter,
        status: statusFilter,
      })
      setPromotions(result.items)
      setPagination({
        page: result.page || page,
        pageSize: result.pageSize || PROMOTION_PAGE_SIZE,
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
  }, [discountTypeFilter, page, promotionSearchTerm, scopeTypeFilter, statusFilter])

  const loadSkuOptions = useCallback(async () => {
    if (skuOptions.length > 0 || isSkuLoading) return

    setIsSkuLoading(true)
    try {
      const items = await fetchAllActiveSkus(100)
      setSkuOptions(items)
    } catch (error) {
      setSkuOptions([])
      showError(error.message)
    } finally {
      setIsSkuLoading(false)
    }
  }, [isSkuLoading, skuOptions.length])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setJumpPopoverKey(null)
    setJumpPageInput('')
  }, [pagination.page, pagination.totalPages])

  const openCreate = () => {
    setEditingId(null)
    setEditingOrderCount(0)
    setForm(EMPTY_FORM)
    setSkuSearchTerm('')
    loadSkuOptions()
    setModalOpen(true)
  }

  const openEdit = (promotion) => {
    setEditingId(promotion.id)
    setEditingOrderCount(Number(promotion.orderCount || 0))
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
      validFrom: promotion.validFromUtc ? toDatetimeLocalValue(promotion.validFromUtc) : '',
      validTo: promotion.validToUtc ? toDatetimeLocalValue(promotion.validToUtc) : '',
      isActive: promotion.isActive ?? true,
      scopeType: promotion.scopeType || 'ORDER',
      skuScopes: Array.isArray(promotion.skuScopes) ? promotion.skuScopes : [],
    })
    setSkuSearchTerm('')
    loadSkuOptions()
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (form.validFrom && form.validTo && form.validTo <= form.validFrom) {
      showError('Thß╗Øi gian kß║┐t th├║c phß║úi sau thß╗Øi gian bß║»t ─æß║ºu.')
      return
    }

    const scopeType = String(form.scopeType || 'ORDER').toUpperCase()
    const skuScopes = scopeType === 'SKU' ? form.skuScopes ?? [] : []
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
    if (scopeType === 'SKU' && skuScopes.length === 0) {
      showError('Vui l├▓ng chß╗ìn ├¡t nhß║Ñt 1 SKU cho phß║ím vi SKU cß╗Ñ thß╗â.')
      return
    }

    if (discountType === 'PERCENTAGE') {
      if (maxDiscountAmount <= 0) {
        showError('Giß║úm tß╗æi ─æa phß║úi lß╗øn hãín 0.')
        return
      }
      if (maxDiscountAmount > MAX_PERCENTAGE_DISCOUNT_AMOUNT) {
        showError('Giß║úm tß╗æi ─æa kh├┤ng qu├í 10.000.000─æ.')
        return
      }
    }

    if (discountType === 'FIXED' && minimumOrderAmount > 0 && discountValue > minimumOrderAmount) {
      showError('Sß╗æ tiß╗ün giß║úm cß╗æ ─æß╗ïnh kh├┤ng ─æã░ß╗úc lß╗øn hãín ─æãín tß╗æi thiß╗âu.')
      return
    }

    if (usageLimitTotal < 0 || usageLimitTotal > MAX_USAGE_LIMIT) {
      showError('Giß╗øi hß║ín tß╗òng lã░ß╗út d├╣ng kh├┤ng hß╗úp lß╗ç.')
      return
    }

    if (usageLimitPerCustomer < 0 || usageLimitPerCustomer > MAX_USAGE_LIMIT) {
      showError('Giß╗øi hß║ín lã░ß╗út d├╣ng mß╗ùi kh├ích kh├┤ng hß╗úp lß╗ç.')
      return
    }

    if (usageLimitTotal > 0 && usageLimitPerCustomer > usageLimitTotal) {
      showError('Giß╗øi hß║ín lã░ß╗út d├╣ng mß╗ùi kh├ích kh├┤ng ─æã░ß╗úc lß╗øn hãín tß╗òng lã░ß╗út d├╣ng.')
      return
    }

    const payload = {
      promoCode: form.promoCode.trim(),
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
    }

    if (!payload.promoCode) {
      showError('Vui l├▓ng nhß║¡p m├ú giß║úm gi├í.')
      return
    }

    if (payload.validFrom && payload.validTo && payload.validFrom > payload.validTo) {
      showError('Ng├áy bß║»t ─æß║ºu kh├┤ng ─æã░ß╗úc sau ng├áy kß║┐t th├║c.')
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateAdminPromotion(editingId, payload)
        showSuccess('─É├ú cß║¡p nhß║¡t m├ú giß║úm gi├í.')
      } else {
        await createAdminPromotion(payload)
        showSuccess('─É├ú th├¬m m├ú giß║úm gi├í.')
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
    if (!window.confirm(`Ngß╗½ng hoß║ít ─æß╗Öng m├ú "${promotion.promoCode}"?`)) return
    try {
      await deactivateAdminPromotion(promotion.id)
      showSuccess('─É├ú ngß╗½ng hoß║ít ─æß╗Öng m├ú giß║úm gi├í.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleReactivate = async (promotion) => {
    try {
      await reactivateAdminPromotion(promotion.id)
      showSuccess('─É├ú k├¡ch hoß║ít lß║íi m├ú giß║úm gi├í.')
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
  const totalPages = Math.max(1, pagination.totalPages)
  const currentPage = Math.min(totalPages, Math.max(1, pagination.page))
  const paginationItems = getPaginationItems(currentPage, totalPages)
  const openJumpPopover = (key) => {
    setJumpPopoverKey((current) => (current === key ? null : key))
    setJumpPageInput('')
  }
  const submitJumpPage = () => {
    const nextPage = Number(jumpPageInput)
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages) return

    setPage(nextPage)
    setJumpPopoverKey(null)
    setJumpPageInput('')
  }
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
  return (
    <PageShell>
      <PageHeader
        title="Quß║ún l├¢ m├ú giß║úm gi├í"
        description="Tß║ío v├á chß╗ënh sß╗¡a m├ú khuyß║┐n m├úi d├╣ng tß║íi POS v├á tr├¬n ─æãín h├áng"
        rightContent={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Th├¬m m├ú
          </button>
        }
      />

      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loß║íi giß║úm: <strong>PERCENTAGE</strong> (% tr├¬n ─æãín sau CK thß╗º c├┤ng) hoß║Àc <strong>FIXED</strong> (sß╗æ tiß╗ün cß╗æ ─æß╗ïnh).
        Thß╗Øi hß║ín ─æß╗â trß╗æng = kh├┤ng giß╗øi hß║ín. Ngß╗½ng hoß║ít ─æß╗Öng thay v├¼ x├│a cß╗®ng ÔÇö m├ú ─æ├ú d├╣ng tr├¬n ─æãín vß║½n giß╗» lß╗ïch sß╗¡.
      </p>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <input
          type="search"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          placeholder="T├¼m kiß║┐m m├ú giß║úm gi├í..."
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
          <option value="ALL">Tß║Ñt cß║ú loß║íi giß║úm</option>
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
          <option value="ALL">Tß║Ñt cß║ú phß║ím vi</option>
          <option value="ORDER">To├án ─æãín</option>
          <option value="SKU">SKU cß╗Ñ thß╗â</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="ALL">Tß║Ñt cß║ú trß║íng th├íi</option>
          <option value="ACTIVE">─Éang k├¡ch hoß║ít</option>
          <option value="INACTIVE">Tß║ím tß║»t</option>
        </select>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">M├ú</th>
                <th className="px-4 py-4">Loß║íi</th>
                <th className="px-4 py-4">Gi├í trß╗ï</th>
                <th className="px-4 py-4">─Éãín tß╗æi thiß╗âu</th>
                <th className="px-4 py-4">Thß╗Øi hß║ín</th>
                <th className="px-4 py-4">Phß║ím vi</th>
                <th className="px-4 py-4">Trß║íng th├íi</th>
                <th className="px-4 py-4">M├┤ tß║ú</th>
                <th className="px-4 py-4">Lã░ß╗út d├╣ng</th>
                <th className="px-8 py-4 text-right">Thao t├íc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={10}>
                    ─Éang tß║úi...
                  </td>
                </tr>
              ) : null}
              {!isLoading && promotions.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={10}>
                    {hasActivePromotionFilter
                      ? 'Kh├┤ng t├¼m thß║Ñy m├ú giß║úm gi├í ph├╣ hß╗úp.'
                      : 'Chã░a c├│ m├ú giß║úm gi├í. Bß║Ñm "Th├¬m m├ú" ─æß╗â tß║ío.'}
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? promotions.map((promotion) => {
                    const status = promotion.validityStatus || 'unlimited'
                    const badgeClass = VALIDITY_BADGE_CLASS[status] ?? VALIDITY_BADGE_CLASS.unlimited

                    return (
                      <tr key={promotion.id} className={`hover:bg-[#fbf9f1]/30 ${!promotion.isActive ? 'opacity-60' : ''}`}>
                        <td className="px-8 py-5 font-bold text-slate-800">{promotion.promoCode}</td>
                        <td className="px-4 py-5 text-slate-600">{promotion.discountType}</td>
                        <td className="px-4 py-5 text-slate-700">
                          {formatPromotionDiscountText(promotion)}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatPromotionMinimumOrderSummary(promotion)}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatPromotionPeriod(promotion)}
                        </td>
                        <td className="max-w-[220px] px-4 py-5 text-sm text-slate-600">
                          <span className="line-clamp-2">{formatPromotionScopeSummary(promotion)}</span>
                        </td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                            {getPromotionValidityLabel(status)}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-sm text-[#538463]">
                          {formatPromotionLabel(promotion)}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatPromotionUsageSummary(promotion).map((line) => (
                            <span key={line} className="block">{line}</span>
                          ))}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Sß╗¡a
                            </button>
                            {promotion.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(promotion)}
                                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              >
                                Ngß╗½ng H─É
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(promotion)}
                                className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                K├¡ch hoß║ít
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => setPage(1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ─Éß║ºu
          </button>
          <button
            type="button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trã░ß╗øc
          </button>
          {paginationItems.map((item) => {
            if (typeof item === 'string') {
              return (
                <span key={item} className="relative inline-flex">
                  <button
                    type="button"
                    title="─Éi tß╗øi trang bß║Ñt kß╗│"
                    onClick={() => openJumpPopover(item)}
                    className="rounded-lg px-2 py-1.5 font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  >
                    ...
                  </button>
                  {jumpPopoverKey === item ? (
                    <span className="absolute left-1/2 top-full z-30 mt-2 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                      <label className="block text-xs font-bold text-slate-500">
                        ─Éi tß╗øi trang
                        <input
                          type="text"
                          inputMode="numeric"
                          value={jumpPageInput}
                          onChange={(event) => setJumpPageInput(event.target.value.replace(/\D/g, ''))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              submitJumpPage()
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
                          placeholder={`1 - ${totalPages}`}
                          autoFocus
                        />
                      </label>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setJumpPopoverKey(null)
                            setJumpPageInput('')
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          Hß╗ºy
                        </button>
                        <button
                          type="button"
                          onClick={submitJumpPage}
                          className="rounded-lg bg-[#538463] px-3 py-1 text-xs font-bold text-white hover:bg-[#457053]"
                        >
                          ─Éi
                        </button>
                      </div>
                    </span>
                  ) : null}
                </span>
              )
            }

            const isCurrent = item === currentPage
            return (
              <button
                key={item}
                type="button"
                disabled={isLoading || isCurrent}
                onClick={() => setPage(item)}
                className={`min-w-9 rounded-lg border px-3 py-1.5 font-semibold ${
                  isCurrent
                    ? 'border-[#538463] bg-[#538463] text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                } disabled:cursor-not-allowed disabled:opacity-80`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {item}
              </button>
            )
          })}
          <button
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tiß║┐p
          </button>
          <button
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => setPage(totalPages)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cuß╗æi
          </button>
        </div>
        <span className="font-semibold text-slate-500">
          Trang {currentPage} / {totalPages}
        </span>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? 'Sß╗¡a m├ú giß║úm gi├í' : 'Th├¬m m├ú giß║úm gi├í'}
            </h2>
            <div className="mt-4 space-y-3">
              {editingOrderCount > 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  M├ú ─æ├ú d├╣ng tr├¬n {editingOrderCount} ─æãín. Chß╗ë c├│ thß╗â chß╗ënh thß╗Øi hß║ín hoß║Àc ngß╗½ng hoß║ít ─æß╗Öng.
                </p>
              ) : null}
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">M├ú</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.promoCode}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
                  placeholder="VD: SALE10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Loß║íi giß║úm</span>
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
                  <option value="PERCENTAGE">PERCENTAGE ÔÇö giß║úm theo %</option>
                  <option value="FIXED">FIXED ÔÇö giß║úm sß╗æ tiß╗ün cß╗æ ─æß╗ïnh</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Gi├í trß╗ï {form.discountType === 'FIXED' ? '(─æ)' : '(%)'}
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
                  <span className="text-xs font-bold uppercase text-slate-400">Giß║úm tß╗æi ─æa</span>
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
                    Bß║»t buß╗Öc vß╗øi m├ú giß║úm phß║ºn tr─âm. Tß╗æi ─æa 10.000.000─æ.
                  </p>
                </label>
              ) : null}
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">─Éãín tß╗æi thiß╗âu</span>
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
                  ─Éß╗â trß╗æng hoß║Àc 0 nß║┐u kh├┤ng y├¬u cß║ºu ─æãín tß╗æi thiß╗âu.
                </p>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Giß╗øi hß║ín tß╗òng lã░ß╗út d├╣ng</span>
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
                    ─Éß╗â trß╗æng hoß║Àc 0 nß║┐u kh├┤ng giß╗øi hß║ín tß╗òng lã░ß╗út d├╣ng.
                  </p>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Giß╗øi hß║ín mß╗ùi kh├ích</span>
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
                    ─Éß╗â trß╗æng hoß║Àc 0 nß║┐u kh├┤ng giß╗øi hß║ín theo tß╗½ng kh├ích h├áng.
                  </p>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Phß║ím vi ├íp dß╗Ñng</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.scopeType}
                  disabled={isImmutableLocked}
                  onChange={(e) => {
                    if (e.target.value === 'SKU') loadSkuOptions()
                    setForm((prev) => ({
                      ...prev,
                      scopeType: e.target.value,
                      skuScopes: e.target.value === 'SKU' ? prev.skuScopes : [],
                    }))
                  }}
                >
                  <option value="ORDER">To├án ─æãín</option>
                  <option value="SKU">SKU cß╗Ñ thß╗â</option>
                </select>
              </label>
              {form.scopeType === 'SKU' ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400">SKU ├íp dß╗Ñng</span>
                    <span className="text-xs text-slate-500">{selectedSkuIds.size} ─æ├ú chß╗ìn</span>
                  </div>
                  <input
                    type="text"
                    className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Nhß║¡p m├ú SKU hoß║Àc t├¬n sß║ún phß║®m..."
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
                              aria-label={`Gß╗í ${scope.skuCode || scope.skuName || scope.skuId}`}
                            >
                              ├ù
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-slate-500">Chã░a chß╗ìn SKU n├áo.</p>
                  )}
                  {isSkuLoading ? (
                    <p className="text-xs text-slate-500">─Éang tß║úi SKU...</p>
                  ) : null}
                  {!isSkuLoading && displaySkuOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">Kh├┤ng c├│ SKU khß║ú dß╗Ñng.</p>
                  ) : null}
                  {!isSkuLoading && displaySkuOptions.length > 0 ? (
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {visibleSkuOptions.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-500">Kh├┤ng t├¼m thß║Ñy SKU ph├╣ hß╗úp.</p>
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
                              {isSelected ? '─É├ú chß╗ìn' : 'Th├¬m'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase text-slate-400">Thß╗Øi gian bß║»t ─æß║ºu</span>
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
                  <span className="block text-xs font-bold uppercase text-slate-400">Thß╗Øi gian kß║┐t th├║c</span>
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
                ─Éß╗â trß╗æng cß║ú hai ├┤ nß║┐u m├ú kh├┤ng giß╗øi hß║ín thß╗Øi gian. Ng├áy t├¡nh theo giß╗Ø Viß╗çt Nam.
              </p>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#538463] focus:ring-[#538463]"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                K├¡ch hoß║ít
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hß╗ºy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? '─Éang lã░u...' : 'Lã░u'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default PromotionsPage
