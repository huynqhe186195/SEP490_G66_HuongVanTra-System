import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { normalizeOrderDiscountInput } from '../../pos/utils/posDiscountValidation.js'
import {
  computeCouponDiscount,
  formatPromotionDiscountText,
  formatPromotionMinimumOrderText,
  formatPromotionUsageText,
} from '../../pos/utils/posPromotionUtils.js'
import {
  applyPromotionPreview,
  fetchAvailablePromotions,
} from '../../pos/services/posApi.js'
import { formatVnd } from '../utils/orderDisplay.js'

function parseMoneyInput(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))
}

function buildPromotionItemsFromOrder(order) {
  return (order?.items || []).map((line) => ({
    skuId: line.skuId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }))
}

function inferPercentFromManual(totalAmount, manualAmount) {
  const total = Math.max(0, Number(totalAmount) || 0)
  const manual = Math.max(0, Number(manualAmount) || 0)
  if (total <= 0 || manual <= 0) return 0
  const pct = Math.round((manual / total) * 100)
  return Math.abs(manual - Math.round((total * pct) / 100)) <= 1 ? pct : 0
}

function OrderUpdateMetaModal({ isOpen, order, isSaving, onClose, onSave }) {
  const [shippingAddress, setShippingAddress] = useState('')
  const [note, setNote] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [customPercent, setCustomPercent] = useState('')
  const [discountFixedInput, setDiscountFixedInput] = useState('')
  const [discountError, setDiscountError] = useState('')

  const [promoSearch, setPromoSearch] = useState('')
  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [promotionTouched, setPromotionTouched] = useState(false)
  const [availablePromotions, setAvailablePromotions] = useState([])
  const [isPromotionListLoading, setIsPromotionListLoading] = useState(false)
  const [isPromotionDropdownOpen, setIsPromotionDropdownOpen] = useState(false)
  const [previewPromotionDiscount, setPreviewPromotionDiscount] = useState(0)

  const promotionsLoadingRef = useRef(false)
  const promotionsLoadedRef = useRef(false)
  const skipInitialPreviewRef = useRef(true)
  const orderSubtotal = Math.max(0, Number(order?.totalAmount || 0))

  const resetForm = useCallback(() => {
    if (!order) return
    const manual = Math.max(0, Number(order.discountAmount || 0) - Number(order.promotionDiscountAmount || 0))
    const inferredPct = inferPercentFromManual(orderSubtotal, manual)
    const preset = [5, 10, 15, 20].includes(inferredPct) ? String(inferredPct) : ''

    setShippingAddress(order.shippingAddress || '')
    setNote(order.note || '')
    setDiscountPercent(preset)
    setCustomPercent(preset ? '' : inferredPct > 0 ? String(inferredPct) : '')
    setDiscountFixedInput(preset || inferredPct > 0 ? '' : manual > 0 ? String(manual) : '')
    setDiscountError('')

    setPromoSearch(order.promotionCode || '')
    setSelectedPromotion(
      order.promotionId
        ? {
            id: order.promotionId,
            promoCode: order.promotionCode || '',
          }
        : null,
    )
    setPromotionTouched(false)
    setPreviewPromotionDiscount(Number(order.promotionDiscountAmount || 0))
    setIsPromotionDropdownOpen(false)
  }, [order, orderSubtotal])

  useEffect(() => {
    if (!isOpen || !order) return
    skipInitialPreviewRef.current = true
    promotionsLoadedRef.current = false
    resetForm()
  }, [isOpen, order?.id, resetForm])

  const loadAvailablePromotions = useCallback(async ({ openDropdown = false } = {}) => {
    if (openDropdown) {
      setIsPromotionDropdownOpen(true)
    }
    if (promotionsLoadingRef.current || promotionsLoadedRef.current) return

    promotionsLoadingRef.current = true
    setIsPromotionListLoading(true)
    try {
      const list = await fetchAvailablePromotions()
      setAvailablePromotions(list)
      promotionsLoadedRef.current = true
    } catch (error) {
      showError(error.message)
      setAvailablePromotions([])
    } finally {
      promotionsLoadingRef.current = false
      setIsPromotionListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    loadAvailablePromotions()
  }, [isOpen, order?.id, loadAvailablePromotions])

  const manualDiscountAmount = useMemo(() => {
    const fixed = parseMoneyInput(discountFixedInput)
    const fromSelect = Number(discountPercent) || 0
    const fromCustom = Math.min(100, Math.max(0, Number(customPercent) || 0))
    const percent = fixed > 0 ? 0 : fromSelect > 0 ? fromSelect : fromCustom

    const result = normalizeOrderDiscountInput({
      percent,
      fixedAmount: fixed,
      subtotalAfterItemDiscount: orderSubtotal,
    })

    if (!result.ok) return 0
    if (result.orderDiscountAmountFixed > 0) return result.orderDiscountAmountFixed
    return Math.round((orderSubtotal * (result.orderDiscountPercent || 0)) / 100)
  }, [customPercent, discountFixedInput, discountPercent, orderSubtotal])

  useEffect(() => {
    if (!isOpen || !order) return undefined

    if (skipInitialPreviewRef.current) {
      skipInitialPreviewRef.current = false
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      const code = (selectedPromotion?.promoCode || promoSearch || '').trim()
      if (!selectedPromotion?.id && !code) {
        if (!cancelled) setPreviewPromotionDiscount(0)
        return
      }

      try {
        const preview = await applyPromotionPreview({
          promotionId: selectedPromotion?.id ?? null,
          promotionCode: selectedPromotion?.id ? null : code,
          customerId: order.customerId,
          items: buildPromotionItemsFromOrder(order),
          manualDiscount: manualDiscountAmount,
        })
        if (cancelled) return
        const amount = preview?.promotionDiscountAmount ?? computeCouponDiscount(
          Math.max(0, orderSubtotal - manualDiscountAmount),
          preview,
        )
        setPreviewPromotionDiscount(Number(amount) || 0)
      } catch {
        if (!cancelled) setPreviewPromotionDiscount(0)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, order, manualDiscountAmount, promoSearch, selectedPromotion, orderSubtotal])

  const visiblePromotions = useMemo(() => {
    const term = promoSearch.trim().toUpperCase()
    if (!term) return availablePromotions.slice(0, 20)
    return availablePromotions
      .filter((promotion) => promotion.promoCode.toUpperCase().includes(term))
      .slice(0, 20)
  }, [availablePromotions, promoSearch])

  const previewFinalAmount = useMemo(() => {
    return Math.max(0, orderSubtotal - manualDiscountAmount - previewPromotionDiscount)
  }, [manualDiscountAmount, orderSubtotal, previewPromotionDiscount])

  const displayPromotion = useMemo(() => {
    if (!selectedPromotion?.id) return selectedPromotion
    return availablePromotions.find((promotion) => promotion.id === selectedPromotion.id) || selectedPromotion
  }, [availablePromotions, selectedPromotion])

  if (!isOpen || !order) return null

  function handleSelectPromotion(promotion) {
    setPromotionTouched(true)
    setSelectedPromotion(promotion)
    setPromoSearch(promotion.promoCode)
    setIsPromotionDropdownOpen(false)
  }

  function handleClearPromotion() {
    setPromotionTouched(true)
    setSelectedPromotion(null)
    setPromoSearch('')
    setPreviewPromotionDiscount(0)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setDiscountError('')

    const fixed = parseMoneyInput(discountFixedInput)
    const fromSelect = Number(discountPercent) || 0
    const fromCustom = Math.min(100, Math.max(0, Number(customPercent) || 0))
    const percent = fixed > 0 ? 0 : fromSelect > 0 ? fromSelect : fromCustom

    const discountResult = normalizeOrderDiscountInput({
      percent,
      fixedAmount: fixed,
      subtotalAfterItemDiscount: orderSubtotal,
    })

    if (!discountResult.ok) {
      setDiscountError(discountResult.error)
      return
    }

    const manual = discountResult.orderDiscountAmountFixed > 0
      ? discountResult.orderDiscountAmountFixed
      : Math.round((orderSubtotal * (discountResult.orderDiscountPercent || 0)) / 100)

    await onSave({
      shippingAddress,
      note,
      manualDiscountAmount: manual,
      promotionTouched,
      promotionId: selectedPromotion?.id ?? null,
      promotionCode: selectedPromotion?.promoCode ?? promoSearch.trim(),
      clearPromotion: promotionTouched && !selectedPromotion?.id && !promoSearch.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-[#f6f4ec] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Cập nhật thông tin đơn</h2>
            <p className="mt-0.5 text-xs text-slate-500">{order.orderCode}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200/60"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <form className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto" onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Địa chỉ giao hàng</span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Nhập địa chỉ giao hàng..."
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Ghi chú đơn hàng</span>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú nội bộ hoặc giao hàng..."
              />
            </label>

            <section className="rounded-xl border border-slate-100 bg-[#fbf9f1] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Chiết khấu / giảm giá đơn</p>

              <label className="mb-2 block text-xs font-semibold text-slate-600">Theo %</label>
              <select
                className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={discountPercent}
                onChange={(event) => {
                  setDiscountError('')
                  setDiscountPercent(event.target.value)
                  if (event.target.value) {
                    setDiscountFixedInput('')
                    setCustomPercent('')
                  }
                }}
                disabled={parseMoneyInput(discountFixedInput) > 0}
              >
                <option value="">Không áp dụng %</option>
                <option value="5">5%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
              </select>
              <input
                type="number"
                min={0}
                max={100}
                disabled={parseMoneyInput(discountFixedInput) > 0}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463] disabled:bg-slate-50"
                placeholder="% khác (0–100)"
                value={customPercent}
                onChange={(event) => {
                  setDiscountError('')
                  setCustomPercent(event.target.value)
                  if (event.target.value !== '') {
                    setDiscountPercent('')
                    setDiscountFixedInput('')
                  }
                }}
              />

              <label className="mb-2 block text-xs font-semibold text-slate-600">Hoặc số tiền (VNĐ)</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                placeholder={orderSubtotal > 0 ? `Tối đa ${formatMoney(orderSubtotal)} đ` : '0'}
                inputMode="numeric"
                value={discountFixedInput}
                onChange={(event) => {
                  setDiscountError('')
                  const parsed = parseMoneyInput(event.target.value)
                  setDiscountFixedInput(event.target.value.replace(/[^\d]/g, ''))
                  if (parsed > 0) {
                    setDiscountPercent('')
                    setCustomPercent('')
                  }
                  if (orderSubtotal > 0 && parsed > orderSubtotal) {
                    setDiscountError(`Giảm giá không được vượt ${formatMoney(orderSubtotal)} đ.`)
                  }
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Đang áp dụng: <span className="font-semibold text-[#356647]">-{formatVnd(manualDiscountAmount)}</span>
              </p>
              {discountError ? (
                <p className="mt-2 text-xs font-medium text-red-600">{discountError}</p>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Mã khuyến mãi</p>

              {displayPromotion?.promoCode ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#538463]/30 bg-[#538463]/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#356647]">{displayPromotion.promoCode}</p>
                    {formatPromotionDiscountText(displayPromotion) ? (
                      <p className="text-xs text-slate-500">{formatPromotionDiscountText(displayPromotion)}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPromotion}
                    className="shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600"
                  >
                    Gỡ
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-[#538463]"
                    placeholder="Tìm hoặc nhập mã KM..."
                    value={promoSearch}
                    onChange={(event) => {
                      setPromotionTouched(true)
                      setSelectedPromotion(null)
                      setPromoSearch(event.target.value.toUpperCase())
                      setIsPromotionDropdownOpen(true)
                    }}
                    onFocus={() => loadAvailablePromotions({ openDropdown: true })}
                    onClick={() => loadAvailablePromotions({ openDropdown: true })}
                    onBlur={() => setTimeout(() => setIsPromotionDropdownOpen(false), 150)}
                  />

                  <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
                      isPromotionDropdownOpen ? 'mt-2 max-h-48 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="custom-scrollbar max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                      {isPromotionListLoading ? (
                        <p className="px-3 py-2.5 text-xs text-slate-500">Đang tải mã KM...</p>
                      ) : null}
                      {!isPromotionListLoading && visiblePromotions.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-slate-500">Không có mã phù hợp.</p>
                      ) : null}
                      {!isPromotionListLoading
                        ? visiblePromotions.map((promotion) => (
                            <button
                              key={promotion.id}
                              type="button"
                              className="block w-full border-b border-slate-50 px-3 py-2.5 text-left text-xs last:border-b-0 hover:bg-[#f6f4ec]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectPromotion(promotion)}
                            >
                              <span className="font-bold text-[#356647]">{promotion.promoCode}</span>
                              <span className="text-slate-600"> — {formatPromotionDiscountText(promotion)}</span>
                              {formatPromotionMinimumOrderText(promotion) ? (
                                <span className="block text-[10px] text-slate-500">
                                  {formatPromotionMinimumOrderText(promotion)}
                                </span>
                              ) : null}
                              {formatPromotionUsageText(promotion) ? (
                                <span className="block text-[10px] text-slate-500">
                                  {formatPromotionUsageText(promotion)}
                                </span>
                              ) : null}
                            </button>
                          ))
                        : null}
                    </div>
                  </div>
                </>
              )}

              <p className="mt-2 text-xs text-slate-500">
                KM ước tính:{' '}
                <span className="font-semibold text-[#356647]">-{formatVnd(previewPromotionDiscount)}</span>
              </p>
            </section>

            <div className="rounded-xl border border-slate-100 bg-[#fbf9f1] p-4 text-sm">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Tạm tính</span>
                <span>{formatVnd(orderSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Giảm thủ công</span>
                <span>-{formatVnd(manualDiscountAmount)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Khuyến mãi</span>
                <span>-{formatVnd(previewPromotionDiscount)}</span>
              </div>
              <div className="flex justify-between py-2 font-semibold text-[#356647]">
                <span>Thành tiền (ước tính)</span>
                <span>{formatVnd(previewFinalAmount)}</span>
              </div>
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-white px-5 py-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default OrderUpdateMetaModal
