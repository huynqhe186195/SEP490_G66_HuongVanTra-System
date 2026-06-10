import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import { formatPromotionLabel } from '../utils/posPromotionUtils.js'

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
  codOverpayToDebt,
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
  debtReductionFromOverpay,
  isDebtSale,
  isPartialPayment,
  isTransferQrFlow,
  transferQrAmount,
  transferOverpayToDebt,
  onQuickAmount,
  onConfirm,
  isSubmitting,
  canPay,
  customerSearchValue,
  onCustomerSearchChange,
  customerSearchResults,
  isCustomerSearchLoading,
  showCustomerDropdown,
  showCustomerSearchEmpty,
  onSelectCustomer,
  onOpenAddCustomer,
  onOpenCustomerDetail,
  onClearCustomer,
  shippingAddress,
  onShippingAddressChange,
  savedShippingAddresses,
  useCustomShippingAddress,
  onSavedShippingAddressChange,
  isLoadingShippingAddresses,
  hasShippingAddress,
  orderDiscountPercentInput,
  onOrderDiscountPercentChange,
  onOpenOfferModal,
  promoCodeInput,
  onPromoCodeChange,
  onApplyPromoCode,
  onClearPromoCode,
  isApplyingPromo,
  orderNote,
  onOrderNoteChange,
}) {
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
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col border-l border-[#c1c9c0] bg-[#fbf9f1] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-4">
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

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          <div className="relative rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Khách hàng</label>
            {selectedCustomer ? (
              <div
                role="button"
                tabIndex={0}
                onClick={onOpenCustomerDetail}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenCustomerDetail()
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1b1c17]">{selectedCustomer.fullName}</p>
                  <p className="truncate text-xs text-[#717971]">
                    {selectedCustomer.phone || '—'} · {selectedCustomer.customerCode}
                  </p>
                  {isVipCustomerType(selectedCustomer.customerType) ? (
                    <p className="mt-1 inline-flex">
                      <span className="rounded-full bg-[#fec25b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#744f00]">
                        Khách VIP
                      </span>
                    </p>
                  ) : selectedCustomer.tierCode ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#356647]">
                      Hạng {selectedCustomer.tierCode}
                      {tierDiscountPercent > 0 ? ` · CK ${tierDiscountPercent}%` : ''}
                    </p>
                  ) : null}
                  {Number(selectedCustomer.currentDebt) > 0 ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#7e5700]">
                      Công nợ: {formatMoney(selectedCustomer.currentDebt)} đ
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClearCustomer()
                  }}
                  className="shrink-0 rounded-lg border border-[#c1c9c0] px-2 py-1 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec]"
                >
                  Đổi
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">person</Icon>
                  <input
                    className="w-full rounded-lg border border-[#c1c9c0]/60 bg-[#fbf9f1] py-2 pl-9 pr-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="Tìm tên, SĐT, mã KH..."
                    value={customerSearchValue}
                    onChange={(event) => onCustomerSearchChange(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={onOpenAddCustomer}
                  className="shrink-0 rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e]"
                >
                  Thêm KH
                </button>
              </div>
            )}
            {!selectedCustomer && isCustomerSearchLoading ? (
              <p className="mt-2 text-xs text-[#717971]">Đang tìm khách hàng...</p>
            ) : null}
            {showCustomerDropdown ? (
              <div className="custom-scrollbar absolute left-3 right-3 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
                {customerSearchResults.map((customer) => (
                  <button
                    key={customer.customerId}
                    type="button"
                    onClick={() => onSelectCustomer(customer)}
                    className="flex w-full flex-col border-b border-[#f0eee6] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f6f4ec]"
                  >
                    <span className="text-sm font-semibold text-[#1b1c17]">{customer.fullName}</span>
                    <span className="text-xs text-[#717971]">
                      {customer.phone || '—'} · {customer.customerCode}
                      {Number(customer.currentDebt) > 0 ? ` · Nợ ${formatMoney(customer.currentDebt)} đ` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {showCustomerSearchEmpty ? (
              <p className="mt-2 text-xs text-[#717971]">Không tìm thấy khách hàng.</p>
            ) : null}
            {!selectedCustomer ? (
              <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Bắt buộc chọn khách trước khi xác nhận.</p>
            ) : null}
          </div>

          {isTakeaway ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-shipping-address">
                Địa chỉ giao hàng
              </label>
              {isLoadingShippingAddresses ? (
                <p className="text-xs text-[#717971]">Đang tải địa chỉ đã giao...</p>
              ) : null}
              {!isLoadingShippingAddresses && savedShippingAddresses.length > 0 ? (
                <select
                  id="sidebar-shipping-address-select"
                  className="mb-2 w-full rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  value={useCustomShippingAddress ? '__custom__' : shippingAddress}
                  onChange={(event) => onSavedShippingAddressChange(event.target.value)}
                >
                  {savedShippingAddresses.map((addr) => (
                    <option key={addr} value={addr}>
                      {addr.length > 72 ? `${addr.slice(0, 72)}…` : addr}
                    </option>
                  ))}
                  <option value="__custom__">Nhập địa chỉ khác...</option>
                </select>
              ) : null}
              {(useCustomShippingAddress || savedShippingAddresses.length === 0) && !isLoadingShippingAddresses ? (
                <textarea
                  id="sidebar-shipping-address"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Số nhà, phường, quận, tỉnh..."
                  value={shippingAddress}
                  onChange={(event) => onShippingAddressChange(event.target.value)}
                />
              ) : null}
              {!hasShippingAddress && !isLoadingShippingAddresses ? (
                <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Vui lòng chọn hoặc nhập địa chỉ giao.</p>
              ) : null}
            </div>
          ) : null}

          {canUseOrderDiscount ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Chiết khấu đơn</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={usesFixedOrderDiscount}
                    className="w-full rounded-lg border border-[#c1c9c0] py-2 pl-3 pr-7 text-sm outline-none focus:border-[#356647] disabled:bg-slate-50 disabled:text-slate-400"
                    value={usesFixedOrderDiscount ? '' : orderDiscountPercentInput || ''}
                    onChange={(event) => onOrderDiscountPercentChange(event.target.value)}
                    placeholder={usesFixedOrderDiscount ? '—' : '0'}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#717971]">%</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenOfferModal}
                  className="shrink-0 rounded-lg border border-[#356647]/40 px-3 py-2 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5"
                >
                  Tùy chỉnh
                </button>
              </div>
              {usesFixedOrderDiscount ? (
                <p className="mt-2 text-xs font-semibold text-[#356647]">
                  CK cố định: -{formatMoney(orderDiscountAmount)} đ
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Mã giảm giá</label>
            {appliedPromotion ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#356647]">
                    {formatPromotionLabel(appliedPromotion)}
                  </p>
                  {couponDiscountAmount > 0 ? (
                    <p className="text-xs text-[#717971]">Giảm {formatMoney(couponDiscountAmount)} đ</p>
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
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-order-note">
              Ghi chú đơn hàng
            </label>
            <textarea
              id="sidebar-order-note"
              rows={2}
              maxLength={500}
              placeholder="VD: Gói quà, giao giờ hành chính..."
              className="w-full resize-none rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
              value={orderNote}
              onChange={(event) => onOrderNoteChange(event.target.value)}
            />
          </div>

          {hasCartItems ? (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#717971]">Chi tiết tổng tiền</p>
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
                  {isCodTakeaway ? 'Số tiền khách trả' : isTransferPayment ? 'Số tiền chuyển khoản' : 'Khách trả'}
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
                      ? codOverpayToDebt > 0
                        ? `Dự kiến thu ${formatMoney(amountPaid)} đ · gồm trừ nợ ${formatMoney(codOverpayToDebt)} đ khi giao.`
                        : `Dự kiến thu ${formatMoney(amountPaid)} đ khi giao hàng.`
                      : `Để trống: thu đúng ${formatMoney(total)} đ khi giao hàng.`
                    : isTransferPayment
                      ? amountPaid > 0
                        ? transferOverpayToDebt > 0
                          ? `Mã QR ${formatMoney(transferQrAmount)} đ · gồm trừ nợ ${formatMoney(transferOverpayToDebt)} đ.`
                          : `Mã QR sẽ hiển thị ${formatMoney(transferQrAmount)} đ.`
                        : `Để trống: mã QR ${formatMoney(total)} đ (thanh toán đủ).`
                      : `Để trống: ghi nợ ${formatMoney(total)} đ.`}
                </p>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f6f4ec] px-3 py-2 text-sm">
                  <span className="text-[#717971]">Đã nhập</span>
                  <span className="font-bold text-[#1b1c17]">{formatMoney(amountPaid)} đ</span>
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
                {change > 0 && canApplyOverpayToDebt && isCodTakeaway ? (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
                    <p className="font-semibold text-orange-800">Thu thừa — trừ công nợ</p>
                    <p className="mt-1 text-xs text-[#717971]">
                      Thừa {formatMoney(change)} đ so với đơn · sẽ trừ nợ{' '}
                      {formatMoney(codOverpayToDebt)} đ khi xác nhận thu COD
                      {change > codOverpayToDebt
                        ? ` · còn ${formatMoney(change - codOverpayToDebt)} đ không trừ được`
                        : ''}
                    </p>
                  </div>
                ) : null}
                {change > 0 && canApplyOverpayToDebt && isTransferPayment ? (
                  <div className="mt-3 rounded-lg border border-[#7e5700]/30 bg-[#fec25b]/15 p-3 text-sm">
                    <p className="font-semibold text-[#7e5700]">CK thừa — trừ công nợ</p>
                    <p className="mt-1 text-xs text-[#717971]">
                      Thừa {formatMoney(change)} đ so với đơn · sẽ trừ nợ{' '}
                      {formatMoney(transferOverpayToDebt)} đ khi CK thành công
                      {change > transferOverpayToDebt
                        ? ` · còn ${formatMoney(change - transferOverpayToDebt)} đ không trừ được`
                        : ''}
                    </p>
                  </div>
                ) : null}
                {change > 0 && canApplyOverpayToDebt && !isTransferPayment && !isCodTakeaway ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#c1c9c0]/60 bg-[#f6f4ec] p-3">
                    <p className="text-xs font-semibold text-[#414942]">Xử lý tiền thừa</p>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="sidebar-overpayment-action"
                        checked={overpaymentAction === 'return_change'}
                        onChange={() => onOverpaymentActionChange('return_change')}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-[#1b1c17]">Trả lại khách</span>
                        <span className="block text-xs text-[#717971]">Tiền thừa: {formatMoney(displayChange)} đ</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="sidebar-overpayment-action"
                        checked={overpaymentAction === 'apply_to_debt'}
                        onChange={() => onOverpaymentActionChange('apply_to_debt')}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-[#1b1c17]">Trừ vào công nợ (in phiếu riêng)</span>
                        <span className="block text-xs text-[#717971]">
                          Trừ tối đa {formatMoney(debtReductionFromOverpay)} đ
                          {displayChange > 0 ? ` · còn thừa ${formatMoney(displayChange)} đ` : ''}
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
                {isCodTakeaway && amountPaid > 0 && amountPaid >= total ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    Dự kiến thu {formatMoney(amountPaid)} đ khi giao
                    {codOverpayToDebt > 0 ? ` · trừ nợ ${formatMoney(codOverpayToDebt)} đ` : ''}
                  </p>
                ) : isDebtSale ? (
                  <p className="mt-1 text-xs font-medium text-[#7e5700]">Bán ghi nợ — chưa thu tiền</p>
                ) : isPartialPayment ? (
                  <p className="mt-1 text-xs text-[#717971]">Thanh toán một phần, phần còn lại ghi vào công nợ</p>
                ) : isTransferQrFlow || isTransferTakeaway ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    Mã QR: {formatMoney(transferQrAmount)} đ
                    {isPartialPayment ? ` · còn nợ ${formatMoney(debtAmount)} đ sau khi CK` : ''}
                    {transferOverpayToDebt > 0 ? ` · trừ nợ ${formatMoney(transferOverpayToDebt)} đ` : ''}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

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
