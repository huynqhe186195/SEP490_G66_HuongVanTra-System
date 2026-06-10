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
  validFrom: '',
  validTo: '',
  isActive: true,
  scopeType: 'ORDER',
  skuScopes: [],
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

  if (from && to) return `${from} → ${to}`
  if (from) return `Từ ${from}`
  if (to) return `Đến ${to}`
  return 'Không giới hạn'
}

function formatDatetimeLocal(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addMinutesToDatetimeLocal(value, minutes) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() + minutes)
  return formatDatetimeLocal(date)
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

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchAdminPromotions()
      setPromotions(items)
    } catch (error) {
      setPromotions([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

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
      discountValue: String(promotion.discountValue),
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
      showError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }

    const scopeType = String(form.scopeType || 'ORDER').toUpperCase()
    const skuScopes = scopeType === 'SKU' ? form.skuScopes ?? [] : []
    if (scopeType === 'SKU' && skuScopes.length === 0) {
      showError('Vui lòng chọn ít nhất 1 SKU cho phạm vi SKU cụ thể.')
      return
    }

    const payload = {
      promoCode: form.promoCode.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      validFrom: fromDatetimeLocalToUtc(form.validFrom),
      validTo: fromDatetimeLocalToUtc(form.validTo),
      isActive: form.isActive,
      scopeType,
      skuScopes,
    }

    if (!payload.promoCode) {
      showError('Vui lòng nhập mã giảm giá.')
      return
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
    if (!window.confirm(`Ngừng hoạt động mã "${promotion.promoCode}"?`)) return
    try {
      await deactivateAdminPromotion(promotion.id)
      showSuccess('Đã ngừng hoạt động mã giảm giá.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleReactivate = async (promotion) => {
    try {
      await reactivateAdminPromotion(promotion.id)
      showSuccess('Đã kích hoạt lại mã giảm giá.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

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
        title="Quản lý mã giảm giá"
        description="Tạo và chỉnh sửa mã khuyến mãi dùng tại POS và trên đơn hàng"
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

      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loại giảm: <strong>PERCENTAGE</strong> (% trên đơn sau CK thủ công) hoặc <strong>FIXED</strong> (số tiền cố định).
        Thời hạn để trống = không giới hạn. Ngừng hoạt động thay vì xóa cứng — mã đã dùng trên đơn vẫn giữ lịch sử.
      </p>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã</th>
                <th className="px-4 py-4">Loại</th>
                <th className="px-4 py-4">Giá trị</th>
                <th className="px-4 py-4">Thời hạn</th>
                <th className="px-4 py-4">Phạm vi</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Mô tả</th>
                <th className="px-4 py-4">Số đơn</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={9}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && promotions.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={9}>
                    Chưa có mã giảm giá. Bấm &quot;Thêm mã&quot; để tạo.
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
                          {promotion.discountType === 'FIXED'
                            ? `${promotion.discountValue.toLocaleString('vi-VN')} đ`
                            : `${promotion.discountValue}%`}
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
                        <td className="px-4 py-5 text-slate-600">{promotion.orderCount}</td>
                        <td className="px-8 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Sửa
                            </button>
                            {promotion.isActive ? (
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

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
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
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Loại giảm</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.discountType}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
                >
                  <option value="PERCENTAGE">PERCENTAGE — giảm theo %</option>
                  <option value="FIXED">FIXED — giảm số tiền cố định</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Giá trị {form.discountType === 'FIXED' ? '(đ)' : '(%)'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.discountValue}
                  disabled={editingOrderCount > 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#538463] focus:ring-[#538463]"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Kích hoạt
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Phạm vi áp dụng</span>
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
                  <option value="ORDER">Toàn đơn</option>
                  <option value="SKU">SKU cụ thể</option>
                </select>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase text-slate-400">Thời gian bắt đầu</span>
                  <input
                    type="datetime-local"
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
                Để trống cả hai ô nếu mã không giới hạn thời gian. Ngày tính theo giờ Việt Nam.
              </p>
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
