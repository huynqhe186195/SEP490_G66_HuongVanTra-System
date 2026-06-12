import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import {
  formatPromotionLabel,
  formatPromotionMinimumOrderText,
  formatPromotionUsageText,
} from '../utils/posPromotionUtils.js'

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
  orderNote,
  onOrderNoteChange,
}) {
  if (!isOpen) return null

  const confirmLabel = isSubmitting
    ? '─Éang xß╗¡ l├¢...'
    : isTakeaway
      ? paymentMethod === 'TRANSFER'
        ? `Tß║ío ─æãín ┬À QR ${formatMoney(transferQrAmount)} ─æ`
        : 'Tß║ío ─æãín COD'
      : isTransferQrFlow
        ? `Thanh to├ín ┬À QR ${formatMoney(transferQrAmount)} ─æ`
        : 'X├íc nhß║¡n thanh to├ín'

  return (
    <>
      <button
        type="button"
        aria-label="─É├│ng thanh to├ín"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col border-l border-[#c1c9c0] bg-[#fbf9f1] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Thanh to├ín"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Thanh to├ín</p>
            <p className="text-2xl font-bold text-[#356647]">{formatMoney(total)} ─æ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
            aria-label="─É├│ng"
          >
            <Icon className="text-[24px]">close</Icon>
          </button>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          <div className="relative rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Kh├ích h├áng</label>
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
                    {selectedCustomer.phone || 'ÔÇö'} ┬À {selectedCustomer.customerCode}
                  </p>
                  {isVipCustomerType(selectedCustomer.customerType) ? (
                    <p className="mt-1 inline-flex">
                      <span className="rounded-full bg-[#fec25b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#744f00]">
                        Kh├ích VIP
                      </span>
                    </p>
                  ) : selectedCustomer.tierCode ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#356647]">
                      Hß║íng {selectedCustomer.tierCode}
                      {tierDiscountPercent > 0 ? ` ┬À CK ${tierDiscountPercent}%` : ''}
                    </p>
                  ) : null}
                  {Number(selectedCustomer.currentDebt) > 0 ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#7e5700]">
                      C├┤ng nß╗ú: {formatMoney(selectedCustomer.currentDebt)} ─æ
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
                  ─Éß╗òi
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">person</Icon>
                  <input
                    className="w-full rounded-lg border border-[#c1c9c0]/60 bg-[#fbf9f1] py-2 pl-9 pr-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="T├¼m t├¬n, S─ÉT, m├ú KH..."
                    value={customerSearchValue}
                    onChange={(event) => onCustomerSearchChange(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={onOpenAddCustomer}
                  className="shrink-0 rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e]"
                >
                  Th├¬m KH
                </button>
              </div>
            )}
            {!selectedCustomer && isCustomerSearchLoading ? (
              <p className="mt-2 text-xs text-[#717971]">─Éang t├¼m kh├ích h├áng...</p>
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
                      {customer.phone || 'ÔÇö'} ┬À {customer.customerCode}
                      {Number(customer.currentDebt) > 0 ? ` ┬À Nß╗ú ${formatMoney(customer.currentDebt)} ─æ` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {showCustomerSearchEmpty ? (
              <p className="mt-2 text-xs text-[#717971]">Kh├┤ng t├¼m thß║Ñy kh├ích h├áng.</p>
            ) : null}
            {!selectedCustomer ? (
              <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Bß║»t buß╗Öc chß╗ìn kh├ích trã░ß╗øc khi x├íc nhß║¡n.</p>
            ) : null}
          </div>

          {isTakeaway ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-shipping-address">
                ─Éß╗ïa chß╗ë giao h├áng
              </label>
              {isLoadingShippingAddresses ? (
                <p className="text-xs text-[#717971]">─Éang tß║úi ─æß╗ïa chß╗ë ─æ├ú giao...</p>
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
                      {addr.length > 72 ? `${addr.slice(0, 72)}ÔÇª` : addr}
                    </option>
                  ))}
                  <option value="__custom__">Nhß║¡p ─æß╗ïa chß╗ë kh├íc...</option>
                </select>
              ) : null}
              {(useCustomShippingAddress || savedShippingAddresses.length === 0) && !isLoadingShippingAddresses ? (
                <textarea
                  id="sidebar-shipping-address"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Sß╗æ nh├á, phã░ß╗Øng, quß║¡n, tß╗ënh..."
                  value={shippingAddress}
                  onChange={(event) => onShippingAddressChange(event.target.value)}
                />
              ) : null}
              {!hasShippingAddress && !isLoadingShippingAddresses ? (
                <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Vui l├▓ng chß╗ìn hoß║Àc nhß║¡p ─æß╗ïa chß╗ë giao.</p>
              ) : null}
            </div>
          ) : null}

          {canUseOrderDiscount ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Chiß║┐t khß║Ñu ─æãín</label>
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
                    placeholder={usesFixedOrderDiscount ? 'ÔÇö' : '0'}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#717971]">%</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenOfferModal}
                  className="shrink-0 rounded-lg border border-[#356647]/40 px-3 py-2 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5"
                >
                  T├╣y chß╗ënh
                </button>
              </div>
              {usesFixedOrderDiscount ? (
                <p className="mt-2 text-xs font-semibold text-[#356647]">
                  CK cß╗æ ─æß╗ïnh: -{formatMoney(orderDiscountAmount)} ─æ
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="relative rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">M├ú giß║úm gi├í</label>
            {appliedPromotion ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#356647]">
                    {couponDiscountAmount > 0
                      ? `M├ú ${appliedPromotion.promoCode} - Giß║úm ${formatMoney(couponDiscountAmount)}─æ`
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
                  Gß╗í
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
                  {isApplyingPromo ? '...' : '├üp dß╗Ñng'}
                </button>
              </div>
            )}
            {isPromotionDropdownOpen ? (
              <div className="custom-scrollbar absolute left-3 right-3 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#c1c9c0] bg-white shadow-2xl">
                {isPromotionListLoading ? (
                  <div className="px-3 py-2 text-xs text-[#717971]">─Éang tß║úi m├ú giß║úm gi├í...</div>
                ) : null}
                {!isPromotionListLoading && visibleAvailablePromotions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#717971]">Kh├┤ng c├│ m├ú giß║úm gi├í ph├╣ hß╗úp vß╗øi ─æãín h├áng hiß╗çn tß║íi.</div>
                ) : null}
                {!isPromotionListLoading
                  ? visibleAvailablePromotions.map((promotion) => {
                      const validityText = formatPromotionValidityText?.(promotion)
                      const scopeText = formatPromotionScopeLabel?.(promotion) || ''
                      const discountText = formatPromotionDiscountText?.(promotion) || ''
                      const minimumText = formatPromotionMinimumOrderText(promotion)
                      const usageText = formatPromotionUsageText(promotion)

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
                          <span className="block text-sm font-bold text-[#263528]">
                            {promotion.promoCode} - {discountText}
                            {scopeText ? ` - ${scopeText}` : ''}
                          </span>
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
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-order-note">
              Ghi ch├║ ─æãín h├áng
            </label>
            <textarea
              id="sidebar-order-note"
              rows={2}
              maxLength={500}
              placeholder="VD: G├│i qu├á, giao giß╗Ø h├ánh ch├¡nh..."
              className="w-full resize-none rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
              value={orderNote}
              onChange={(event) => onOrderNoteChange(event.target.value)}
            />
          </div>

          {hasCartItems ? (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#717971]">Chi tiß║┐t tß╗òng tiß╗ün</p>
              <div className="space-y-1 text-sm text-[#717971]">
                <div className="flex justify-between">
                  <span>Tß║ím t├¡nh</span>
                  <span>{formatMoney(grossSubtotal)} ─æ</span>
                </div>
                {itemDiscountTotal > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>CK tß╗½ng SP</span>
                    <span>-{formatMoney(itemDiscountTotal)} ─æ</span>
                  </div>
                ) : null}
                {canUseOrderDiscount && orderDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>{usesFixedOrderDiscount ? 'CK ─æãín (VN─É)' : `CK ─æãín (${orderDiscountPercent}%)`}</span>
                    <span>-{formatMoney(orderDiscountAmount)} ─æ</span>
                  </div>
                ) : null}
                {couponDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>M├ú {appliedPromotion?.promoCode || 'giß║úm gi├í'}</span>
                    <span>-{formatMoney(couponDiscountAmount)} ─æ</span>
                  </div>
                ) : null}
                {membershipDiscountAmount > 0 ? (
                  <div className="flex justify-between text-[#356647]">
                    <span>
                      CK hß║íng {selectedCustomer?.tierCode || 'VIP'} ({tierDiscountPercent}%)
                    </span>
                    <span>-{formatMoney(membershipDiscountAmount)} ─æ</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[#f0eee6] pt-2 text-base font-bold text-[#356647]">
                  <span>Th├ánh tiß╗ün</span>
                  <span>{formatMoney(total)} ─æ</span>
                </div>
              </div>
            </div>
          ) : null}

          {isZeroAmountSale ? (
            <p className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 px-4 py-3 text-xs text-[#356647]">
              ─Éãín 0 ─æ sau chiß║┐t khß║Ñu ÔÇö chß╗ìn tiß╗ün mß║Àt, kh├┤ng cß║ºn nhß║¡p tiß╗ün kh├ích trß║ú.
            </p>
          ) : null}

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">
              Phã░ãíng thß╗®c thanh to├ín
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
              <p className="font-semibold text-orange-800">Thanh to├ín COD</p>
              <p className="mt-1 text-xs text-[#717971]">
                Kh├ích thanh to├ín khi nhß║¡n h├áng. Theo d├Ái tß║íi Quß║ún l├¢ ─æãín COD.
              </p>
            </div>
          ) : null}

          {isTransferTakeaway ? (
            <div className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 p-4 text-sm text-[#414942]">
              <p className="font-semibold text-[#356647]">Chuyß╗ân khoß║ún (VietQR)</p>
              <p className="mt-1 text-xs text-[#717971]">
                Kh├ích qu├®t m├ú QR ─æß╗â thanh to├ín trã░ß╗øc hoß║Àc khi nhß║¡n h├áng.
              </p>
            </div>
          ) : null}

          {!isTakeaway || isCodTakeaway || isTransferTakeaway ? (
            <>
              {customerCurrentDebt > 0 ? (
                <div className="rounded-xl border border-[#7e5700]/30 bg-[#fec25b]/15 px-4 py-3 text-sm">
                  <p className="font-semibold text-[#7e5700]">C├┤ng nß╗ú hiß╗çn tß║íi</p>
                  <p className="mt-0.5 text-lg font-bold text-[#604100]">{formatMoney(customerCurrentDebt)} ─æ</p>
                </div>
              ) : null}

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="sidebar-amount-paid">
                  {isCodTakeaway ? 'Sß╗æ tiß╗ün kh├ích trß║ú' : isTransferPayment ? 'Sß╗æ tiß╗ün chuyß╗ân khoß║ún' : 'Kh├ích trß║ú'}
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
                      ? `Dß╗▒ kiß║┐n thu ${formatMoney(amountPaid)} ─æ khi giao h├áng.`
                      : `─Éß╗â trß╗æng: thu ─æ├║ng ${formatMoney(total)} ─æ khi giao h├áng.`
                    : isTransferPayment
                      ? amountPaid > 0
                        ? `M├ú QR sß║¢ hiß╗ân thß╗ï ${formatMoney(transferQrAmount)} ─æ.`
                        : `─Éß╗â trß╗æng: m├ú QR ${formatMoney(total)} ─æ (thanh to├ín ─æß╗º).`
                      : `─Éß╗â trß╗æng: ghi nß╗ú ${formatMoney(total)} ─æ.`}
                </p>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f6f4ec] px-3 py-2 text-sm">
                  <span className="text-[#717971]">─É├ú nhß║¡p</span>
                  <span className="font-bold text-[#1b1c17]">{formatMoney(amountPaid)} ─æ</span>
                </div>
                {!isCodTakeaway && debtAmount > 0 ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-[#fec25b]/20 px-3 py-2 text-sm">
                    <span className="font-semibold text-[#7e5700]">Dã░ nß╗ú (─æãín n├áy)</span>
                    <span className="font-bold text-[#7e5700]">{formatMoney(debtAmount)} ─æ</span>
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
                    ─É├║ng tiß╗ün
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#717971]">Tiß╗ün thß╗½a</label>
                <div className={`text-2xl font-bold ${change > 0 ? 'text-[#356647]' : 'text-[#717971]'}`}>
                  {change > 0 ? `${formatMoney(change)} ─æ` : 'ÔÇö'}
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
                        <span className="font-semibold text-[#1b1c17]">Tiß╗ün thß╗½a trß║ú kh├ích</span>
                        <span className="font-bold tabular-nums text-[#356647]">{formatMoney(change)} ─æ</span>
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
                        T├¡nh v├áo c├┤ng nß╗ú
                      </span>
                    </button>
                    {overpaymentAction === 'apply_to_debt' && confirmedDebtAllocationAmount > 0 ? (
                      <p className="pl-6 text-xs text-[#356647]">
                        ─É├ú chß╗ìn trß╗½ {formatMoney(confirmedDebtAllocationAmount)} ─æ v├áo h├│a ─æãín nß╗ú ┬À{' '}
                        <button
                          type="button"
                          onClick={onOpenDebtAllocation}
                          className="font-semibold underline underline-offset-2"
                        >
                          Sß╗¡a
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isCodTakeaway && amountPaid > 0 && amountPaid >= total ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    Dß╗▒ kiß║┐n thu {formatMoney(amountPaid)} ─æ khi giao
                  </p>
                ) : isDebtSale ? (
                  <p className="mt-1 text-xs font-medium text-[#7e5700]">B├ín ghi nß╗ú ÔÇö chã░a thu tiß╗ün</p>
                ) : isPartialPayment ? (
                  <p className="mt-1 text-xs text-[#717971]">Thanh to├ín mß╗Öt phß║ºn, phß║ºn c├▓n lß║íi ghi v├áo c├┤ng nß╗ú</p>
                ) : isTransferQrFlow || isTransferTakeaway ? (
                  <p className="mt-1 text-xs text-[#717971]">
                    M├ú QR: {formatMoney(transferQrAmount)} ─æ
                    {isPartialPayment ? ` ┬À c├▓n nß╗ú ${formatMoney(debtAmount)} ─æ sau khi CK` : ''}
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
