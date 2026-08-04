import { Link } from 'react-router-dom'
import {
  formatPromotionLabel,
  formatPromotionMinimumOrderText,
  formatPromotionUsageText,
} from '../utils/posPromotionUtils.js'
import { useMediaQuery, useResizableWidth } from '../../../hooks/useResizableWidth.js'
import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'

const PAYMENT_SIDEBAR_WIDTH_KEY = 'hvt-pos-payment-sidebar-width'
const PAYMENT_SIDEBAR_DEFAULT_WIDTH = 448

function Icon({ children, className = '', filled = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {children}
    </span>
  )
}

export default function PosPaymentSidebar({
  isOpen,
  onClose,
  formatMoney,
  total,
  grossSubtotal,
  itemDiscountTotal,
  orderDiscountAmount,
  orderDiscountPercent,
  couponDiscountAmount,
  membershipDiscountAmount,
  appliedPromotion,
  selectedCustomer,
  tierDiscountPercent,
  canUseOrderDiscount,
  usesFixedOrderDiscount,
  isZeroAmountSale,
  hasCartItems,
  isTakeaway,
  paymentMethod,
  paymentMethods,
  onPaymentMethodChange,
  isTransferPayment,
  isCodTakeaway,
  isTransferTakeaway,
  customerCurrentDebt,
  amountPaidInput,
  onAmountPaidChange,
  amountPaid,
  debtAmount,
  change,
  displayChange,
  canApplyOverpayToDebt,
  overpaymentAction,
  onOverpaymentActionChange,
  onOpenDebtAllocation,
  confirmedDebtAllocationAmount = 0,
  isDebtSale,
  isPartialPayment,
  isTransferQrFlow,
  transferQrAmount,
  onQuickAmount,
  onConfirm,
  isSubmitting,
  canPay,
  onOpenCustomerDetail,
  onClearCustomer,
  shippingAddress,
  onShippingAddressChange,
  savedShippingAddresses,
  useCustomShippingAddress,
  onSavedShippingAddressChange,
  isLoadingShippingAddresses,
  onRefreshShippingAddresses,
  hasShippingAddress,
  orderDiscountPercentInput,
  onOrderDiscountPercentChange,
  onOpenOfferModal,
  promoCodeInput,
  onPromoCodeChange,
  onApplyPromoCode,
  onClearPromoCode,
  isApplyingPromo,
  visibleAvailablePromotions = [],
  isPromotionDropdownOpen,
  isPromotionListLoading,
  onLoadAvailablePromotions,
  onSelectPromotion,
  onClosePromotionDropdown,
  formatPromotionDiscountText,
  formatPromotionValidityText,
  formatPromotionScopeLabel,
  appliedPromotionScopeText,
  cartItemLines = [],
}) {
  const isCompact = useMediaQuery('(max-width: 639px)')
  const { width, isDragging, startResize, resetWidth } = useResizableWidth({
    storageKey: PAYMENT_SIDEBAR_WIDTH_KEY,
    defaultWidth: PAYMENT_SIDEBAR_DEFAULT_WIDTH,
    minWidth: 320,
    maxWidth: () => Math.min(820, Math.round(window.innerWidth * 0.92)),
    direction: 'from-right',
  })

  if (!isOpen) return null

  const confirmLabel = isSubmitting
    ? 'Đang xử lý...'
    : isTakeaway
      ? paymentMethod === 'TRANSFER'
        ? `Tạo đơn · QR ${formatMoney(transferQrAmount)} đ`
        : 'Tạo đơn COD'
      : isTransferQrFlow
        ? `Thanh toán · QR ${formatMoney(transferQrAmount)} đ`
        : 'Xác nhận thanh toán'

  return (
    <>
      <button
        type="button"
        aria-label="Đóng thanh toán"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[61] flex flex-col border-l border-[#c1c9c0] bg-[#fbf9f1] shadow-2xl"
        style={isCompact ? { width: '100%' } : { width: `${width}px`, maxWidth: '92vw' }}
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán"
      >
        {!isCompact ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để chỉnh độ rộng sidebar thanh toán"
            aria-valuenow={width}
            onPointerDown={startResize}
            onDoubleClick={resetWidth}
            className={`absolute bottom-0 left-0 top-0 z-10 w-1.5 touch-none select-none ${
              isDragging ? 'bg-[#356647]/35' : 'bg-[#c1c9c0] hover:bg-[#356647]/25'
            }`}
            style={{ cursor: 'col-resize' }}
          >
            <div className="absolute inset-y-0 -left-2 -right-2" />
          </div>
        ) : null}

        <header className="relative flex shrink-0 items-center justify-between border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Thanh toán</p>
            <p className="text-2xl font-bold text-[#356647]">{formatMoney(total)} đ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
            aria-label="Đóng"
          >
            <Icon className="text-[24px]">close</Icon>
          </button>
        </header>

        <CustomScrollArea className="flex-1" contentClassName="space-y-4 p-4">
          {selectedCustomer ? (
            <div className="rounded-xl border border-[#356647]/20 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Khách thanh toán</p>
                  <button
                    type="button"
                    onClick={onOpenCustomerDetail}
                    className="mt-1 block w-full truncate text-left text-sm font-semibold text-[#1b1c17] hover:text-[#356647]"
                  >
                    {selectedCustomer.fullName}
                  </button>
                  <p className="truncate text-xs text-[#717971]">
                    {selectedCustomer.phone || '—'} · {selectedCustomer.customerCode}
                  </p>
                  {Number(selectedCustomer.currentDebt) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-[#7e5700]">
                      Công nợ: {formatMoney(selectedCustomer.currentDebt)} đ
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClearCustomer}
                  className="shrink-0 rounded-lg border border-[#c1c9c0] px-2 py-1 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec]"
                >
                  Đổi
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-[#ba1a1a]/30 bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#ba1a1a]">
              Chưa chọn khách — tìm hoặc thêm khách ở panel bên phải.
            </p>
          )}

          {isTakeaway ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-shipping-address">
                  Địa chỉ giao hàng
                </label>
                <div className="flex items-center gap-2">
                  {selectedCustomer?.customerId ? (
                    <Link
                      to={`/customers/${selectedCustomer.customerId}/addresses`}
                      className="text-[11px] font-semibold text-[#356647] underline underline-offset-2"
                      title="Quản lý địa chỉ khách"
                    >
                      Quản lý
                    </Link>
                  ) : null}
                  {typeof onRefreshShippingAddresses === 'function' ? (
                    <button
                      type="button"
                      onClick={onRefreshShippingAddresses}
                      disabled={isLoadingShippingAddresses || !selectedCustomer?.customerId}
                      className="rounded-md border border-[#c1c9c0] px-1.5 py-0.5 text-[11px] font-semibold text-[#414942] hover:bg-[#f3f5f1] disabled:opacity-40"
                    >
                      Tải lại
                    </button>
                  ) : null}
                </div>
              </div>
              {!selectedCustomer?.customerId ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Chọn khách hàng trước để dùng địa chỉ đã lưu.
                </p>
              ) : null}
              {selectedCustomer?.customerId && isLoadingShippingAddresses ? (
                <p className="text-xs text-[#717971]">Đang tải địa chỉ đã lưu...</p>
              ) : null}
              {selectedCustomer?.customerId && !isLoadingShippingAddresses && savedShippingAddresses.length > 0 ? (
                <select
                  id="sidebar-shipping-address-select"
                  className="mb-2 w-full rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  value={useCustomShippingAddress ? '__custom__' : shippingAddress}
                  onChange={(event) => onSavedShippingAddressChange(event.target.value)}
                >
                  {savedShippingAddresses.map((addr) => {
                    const value = typeof addr === 'string' ? addr : addr.address
                    const label = typeof addr === 'string' ? addr : (addr.label || addr.address)
                    return (
                      <option key={value} value={value}>
                        {label.length > 80 ? `${label.slice(0, 80)}…` : label}
                      </option>
                    )
                  })}
                  <option value="__custom__">Nhập địa chỉ khác...</option>
                </select>
              ) : null}
              {selectedCustomer?.customerId
                && !isLoadingShippingAddresses
                && savedShippingAddresses.length === 0 ? (
                <p className="mb-2 rounded-lg border border-dashed border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-xs text-[#717971]">
                  Khách chưa có địa chỉ đã lưu.{' '}
                  <Link
                    to={`/customers/${selectedCustomer.customerId}/addresses`}
                    className="font-semibold text-[#356647] underline underline-offset-2"
                  >
                    Thêm địa chỉ
                  </Link>
                  {' '}hoặc nhập bên dưới.
                </p>
              ) : null}
              {selectedCustomer?.customerId
                && (useCustomShippingAddress || savedShippingAddresses.length === 0)
                && !isLoadingShippingAddresses ? (
                <textarea
                  id="sidebar-shipping-address"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Số nhà, phường, quận, tỉnh..."
                  value={shippingAddress}
                  onChange={(event) => onShippingAddressChange(event.target.value)}
                />
              ) : null}
              {selectedCustomer?.customerId && !hasShippingAddress && !isLoadingShippingAddresses ? (
                <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Vui lòng chọn hoặc nhập địa chỉ giao.</p>
              ) : null}
            </div>
          ) : null}

          {canUseOrderDiscount ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Chiết khấu đơn</p>
                  {orderDiscountAmount > 0 ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-[#356647]">
                        -{formatMoney(orderDiscountAmount)} đ
                        {usesFixedOrderDiscount ? '' : orderDiscountPercent > 0 ? ` (${orderDiscountPercent}%)` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOrderDiscountPercentChange?.('0')}
                        className="mt-1 text-xs font-semibold text-[#717971] hover:text-[#ba1a1a]"
                      >
                        Xóa chiết khấu
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-[#414942]">Chưa áp dụng</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onOpenOfferModal}
                  className="shrink-0 rounded-lg border border-[#356647]/40 px-3 py-2 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5"
                >
                  Tùy chỉnh
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Mã giảm giá</label>
            {appliedPromotion ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#356647]">
                    {couponDiscountAmount > 0
                      ? `Mã ${appliedPromotion.promoCode} - Giảm ${formatMoney(couponDiscountAmount)}đ`
                      : formatPromotionLabel(appliedPromotion)}
                  </p>
                  {appliedPromotionScopeText ? (
                    <p className="text-xs text-[#717971]">{appliedPromotionScopeText}</p>
                  ) : null}
                  {formatPromotionMinimumOrderText(appliedPromotion) ? (
                    <p className="text-xs text-[#717971]">{formatPromotionMinimumOrderText(appliedPromotion)}</p>
                  ) : null}
                  {formatPromotionUsageText(appliedPromotion) ? (
                    <p className="text-xs text-[#717971]">{formatPromotionUsageText(appliedPromotion)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClearPromoCode}
                  className="shrink-0 text-xs font-semibold text-[#717971] hover:text-[#ba1a1a]"
                >
                  Gỡ
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm uppercase outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="VD: SALE10"
                  value={promoCodeInput}
                  onChange={(event) => onPromoCodeChange(event.target.value.toUpperCase())}
                  onFocus={onLoadAvailablePromotions}
                  onClick={onLoadAvailablePromotions}
                  onBlur={() => setTimeout(() => onClosePromotionDropdown?.(), 150)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onApplyPromoCode()
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isApplyingPromo || !promoCodeInput.trim()}
                  onClick={onApplyPromoCode}
                  className="shrink-0 rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e] disabled:opacity-50"
                >
                  {isApplyingPromo ? '...' : 'Áp dụng'}
                </button>
              </div>
            )}
            {isPromotionDropdownOpen ? (
              <CustomScrollArea className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-[#c1c9c0] bg-white shadow-2xl" contentClassName="max-h-56">
                {isPromotionListLoading ? (
                  <div className="px-3 py-2 text-xs text-[#717971]">Đang tải mã giảm giá...</div>
                ) : null}
                {!isPromotionListLoading && visibleAvailablePromotions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#717971]">Không có mã giảm giá phù hợp với đơn hàng hiện tại.</div>
                ) : null}
                {!isPromotionListLoading
                  ? visibleAvailablePromotions.map((promotion) => {
                      const validityText = formatPromotionValidityText?.(promotion)
                      const scopeText = formatPromotionScopeLabel?.(promotion) || ''
                      const discountText = formatPromotionDiscountText?.(promotion) || ''
                      const minimumText = formatPromotionMinimumOrderText(promotion)
                      const usageText = formatPromotionUsageText(promotion)
                      const estimatedDiscountAmount = Number(promotion.estimatedDiscountAmount || 0)
                      const estimatedDiscountText = Number.isFinite(estimatedDiscountAmount) && estimatedDiscountAmount > 0
                        ? `Dự kiến giảm ${formatMoney(estimatedDiscountAmount)}đ`
                        : ''

                      return (
                        <button
                          key={promotion.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            onSelectPromotion?.(promotion)
                          }}
                          className="block w-full border-b border-[#f0eee6] px-3 py-2 text-left last:border-b-0 hover:bg-[#f6f4ec]"
                        >
                          <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#263528]">
                            <span>
                              {promotion.promoCode} - {discountText}
                              {scopeText ? ` - ${scopeText}` : ''}
                            </span>
                            {promotion.isBestSuggestion ? (
                              <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-bold text-[#2f6b3f]">
                                Gợi ý tốt nhất
                              </span>
                            ) : null}
                          </span>
                          {estimatedDiscountText ? (
                            <span className="block text-xs font-semibold text-[#356647]">{estimatedDiscountText}</span>
                          ) : null}
                          {validityText ? (
                            <span className="block text-xs text-[#717971]">{validityText}</span>
                          ) : null}
                          {minimumText ? (
                            <span className="block text-xs text-[#717971]">{minimumText}</span>
                          ) : null}
                          {usageText ? (
                            <span className="block text-xs text-[#717971]">{usageText}</span>
                          ) : null}
                        </button>
                      )
                    })
                  : null}
              </CustomScrollArea>
            ) : null}
          </div>

          {hasCartItems ? (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Chi tiết tổng tiền</p>
                <span className="text-xs text-[#717971]">{cartItemLines.length} mặt hàng</span>
              </div>

              <CustomScrollArea className="mb-3 border-b border-[#f0eee6]" contentClassName="max-h-56 space-y-2 pb-3">
                {cartItemLines.map((line) => (
                  <div key={line.key} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-[#1b1c17]" title={line.name}>
                        {line.name}
                        {line.isGift ? (
                          <span className="ml-1.5 rounded-full bg-[#fff8e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#7e5700]">
                            Quà
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-[#717971]">
                        {line.qty} × {formatMoney(line.unitPrice)} đ
                        {line.discountLabel ? (
                          <>
                            <span className="mx-1">·</span>
                            <span className="font-semibold text-[#7e5700]">CK {line.discountLabel}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      {line.lineDiscount > 0 && !line.isGift ? (
                        <p className="text-[11px] text-[#717971] line-through">{formatMoney(line.lineGross)} đ</p>
                      ) : null}
                      <p className="font-semibold text-[#1b1c17]">{formatMoney(line.lineTotal)} đ</p>
                    </div>
                  </div>
                ))}
              </CustomScrollArea>

              <div className="space-y-1 text-sm text-[#717971]">
                <div className="flex justify-between">
                  <span>Tạm tính</span>
                  <span>{formatMoney(grossSubtotal)} đ</span>
                </div>
                {itemDiscountTotal > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>CK từng SP</span>
                    <span>-{formatMoney(itemDiscountTotal)} đ</span>
                  </div>
                ) : null}
                {canUseOrderDiscount && orderDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>{usesFixedOrderDiscount ? 'CK đơn (VNĐ)' : `CK đơn (${orderDiscountPercent}%)`}</span>
                    <span>-{formatMoney(orderDiscountAmount)} đ</span>
                  </div>
                ) : null}
                {couponDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>Mã {appliedPromotion?.promoCode || 'giảm giá'}</span>
                    <span>-{formatMoney(couponDiscountAmount)} đ</span>
                  </div>
                ) : null}
                {membershipDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>
                      CK hạng {selectedCustomer?.tierCode || 'VIP'} ({tierDiscountPercent}%)
                    </span>
                    <span>-{formatMoney(membershipDiscountAmount)} đ</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[#f0eee6] pt-2 text-base font-bold text-[#356647]">
                  <span>Thành tiền</span>
                  <span>{formatMoney(total)} đ</span>
                </div>
              </div>
            </div>
          ) : null}

          {isZeroAmountSale ? (
            <p className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 px-4 py-3 text-xs text-[#356647]">
              Đơn 0 đ sau chiết khấu — chọn tiền mặt, không cần nhập tiền khách trả.
            </p>
          ) : null}

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">
              Phương thức thanh toán
            </label>
            <div className="space-y-1.5">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => onPaymentMethodChange(method.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all ${
                    paymentMethod === method.id
                      ? 'border-[#356647] bg-[#356647]/10 font-semibold text-[#356647]'
                      : 'border-transparent bg-[#fbf9f1] hover:border-[#c1c9c0]'
                  }`}
                >
                  <Icon className="text-[20px]" filled={paymentMethod === method.id}>
                    {method.icon}
                  </Icon>
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {isCodTakeaway ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-[#414942]">
              <p className="font-semibold text-orange-800">Thanh toán COD</p>
              <p className="mt-1 text-xs text-[#717971]">
                Khách thanh toán khi nhận hàng. Theo dõi tại Quản lý đơn COD.
              </p>
            </div>
          ) : null}

          {isTransferTakeaway ? (
            <div className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 p-4 text-sm text-[#414942]">
              <p className="font-semibold text-[#356647]">Chuyển khoản (VietQR)</p>
              <p className="mt-1 text-xs text-[#717971]">
                Khách quét mã QR để thanh toán trước hoặc khi nhận hàng.
              </p>
            </div>
          ) : null}

          {!isTakeaway || isCodTakeaway || isTransferTakeaway ? (
            <>
              {customerCurrentDebt > 0 ? (
                <div className="rounded-xl border border-[#7e5700]/30 bg-[#fec25b]/15 px-4 py-3 text-sm">
                  <p className="font-semibold text-[#7e5700]">Công nợ hiện tại</p>
                  <p className="mt-0.5 text-lg font-bold text-[#604100]">{formatMoney(customerCurrentDebt)} đ</p>
                </div>
              ) : null}

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-amount-paid">
                  {isCodTakeaway
                    ? 'Số tiền khách trả'
                    : isTransferPayment
                      ? 'Số tiền chuyển khoản'
                      : 'Khách trả'}
                </label>
                <input
                  id="sidebar-amount-paid"
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-2xl font-bold tabular-nums outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  value={amountPaidInput}
                  onChange={(event) => onAmountPaidChange(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-[#717971]">
                  {isCodTakeaway
                    ? amountPaid > 0
                      ? `Dự kiến thu ${formatMoney(amountPaid)} đ khi giao hàng.`
                      : `Để trống: thu đúng ${formatMoney(total)} đ khi giao hàng.`
                    : isTransferPayment
                      ? amountPaid > 0
                        ? `Mã QR hiển thị ${formatMoney(transferQrAmount)} đ (chưa ghi nhận đã thu).`
                        : `Để trống: mã QR ${formatMoney(total)} đ — khách quét để thanh toán.`
                      : `Để trống: ghi nợ ${formatMoney(total)} đ.`}
                </p>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f6f4ec] px-3 py-2 text-sm">
                  <span className="text-[#717971]">Đã nhập</span>
                  <span className="font-bold text-[#1b1c17]">
                    {formatMoney(amountPaid)} đ
                  </span>
                </div>
                {!isCodTakeaway && debtAmount > 0 ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-[#fec25b]/20 px-3 py-2 text-sm">
                    <span className="font-semibold text-[#7e5700]">Dư nợ (đơn này)</span>
                    <span className="font-bold text-[#7e5700]">{formatMoney(debtAmount)} đ</span>
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {[50000, 100000, 200000, 500000, 1000000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => onQuickAmount(quick)}
                      className="rounded-lg bg-[#e4e3db] py-1.5 text-[10px] font-bold hover:bg-[#356647] hover:text-white"
                    >
                      {formatMoney(quick)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onQuickAmount(total)}
                    className="rounded-lg bg-[#356647]/15 py-1.5 text-[10px] font-bold text-[#356647] hover:bg-[#356647] hover:text-white"
                  >
                    Đúng tiền
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#717971]">Tiền thừa</label>
                <div className={`text-2xl font-bold ${change > 0 ? 'text-[#356647]' : 'text-[#717971]'}`}>
                  {change > 0 ? `${formatMoney(change)} đ` : '—'}
                </div>
                {change > 0 && canApplyOverpayToDebt ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#c1c9c0]/60 bg-[#f6f4ec] p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="sidebar-overpayment-action"
                        checked={overpaymentAction === 'return_change'}
                        onChange={() => onOverpaymentActionChange('return_change')}
                        className="size-4"
                      />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span className="font-semibold text-[#1b1c17]">Tiền thừa trả khách</span>
                        <span className="font-bold tabular-nums text-[#356647]">{formatMoney(change)} đ</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={onOpenDebtAllocation}
                      className="flex w-full items-center gap-2 text-left text-sm"
                    >
                      <span
                        className={`size-4 shrink-0 rounded-full border-2 ${
                          overpaymentAction === 'apply_to_debt'
                            ? 'border-[#356647] bg-[#356647] shadow-[inset_0_0_0_3px_white]'
                            : 'border-[#c1c9c0] bg-white'
                        }`}
                        aria-hidden
                      />
                      <span className="font-semibold text-[#356647] underline decoration-[#356647]/35 underline-offset-2 hover:decoration-[#356647]">
                        Trừ vào công nợ
                      </span>
                    </button>
                    {overpaymentAction === 'apply_to_debt' && confirmedDebtAllocationAmount > 0 ? (
                      <div className="space-y-1 pl-6 text-xs">
                        <p className="text-[#717971]">
                          Trừ nợ:{' '}
                          <span className="font-bold tabular-nums text-[#7e5700]">
                            {formatMoney(confirmedDebtAllocationAmount)} đ
                          </span>
                        </p>
                        <p className="text-[#356647]">
                          Còn trả khách:{' '}
                          <span className="font-bold tabular-nums">{formatMoney(displayChange)} đ</span>
                          {' · '}
                          <button
                            type="button"
                            onClick={onOpenDebtAllocation}
                            className="font-semibold underline underline-offset-2"
                          >
                            Sửa
                          </button>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isCodTakeaway && amountPaid > 0 && amountPaid >= total ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    Dự kiến thu {formatMoney(amountPaid)} đ khi giao
                  </p>
                ) : isDebtSale ? (
                  <p className="mt-1 text-xs font-medium text-[#7e5700]">Bán ghi nợ — chưa thu tiền</p>
                ) : isPartialPayment ? (
                  <p className="mt-1 text-xs text-[#717971]">Thanh toán một phần, phần còn lại ghi vào công nợ</p>
                ) : isTransferQrFlow || isTransferTakeaway ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    Mã QR: {formatMoney(transferQrAmount)} đ
                    {isPartialPayment ? ` · còn nợ ${formatMoney(debtAmount)} đ sau khi CK` : ''}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </CustomScrollArea>

        <footer className="shrink-0 border-t border-[#c1c9c0] bg-white p-4">
          <button
            type="button"
            disabled={!canPay || isSubmitting}
            onClick={onConfirm}
            className="flex w-full flex-col items-center justify-center rounded-xl bg-[#356647] py-3.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </footer>
      </aside>
    </>
  )
}
