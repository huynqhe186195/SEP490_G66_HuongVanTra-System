function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Tiền mặt', icon: 'payments' },
  { id: 'TRANSFER', label: 'Chuyển khoản', icon: 'account_balance' },
]

function PaymentMethodPicker({ paymentMethod, onPaymentMethodChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAYMENT_METHODS.map((method) => {
        const active = paymentMethod === method.id
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onPaymentMethodChange(method.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              active
                ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="text-[18px]">{method.icon}</Icon>
            {method.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ReturnOrderSidebar({
  customerName,
  customerPhone,
  createdAtLabel,
  sourceOrderCode,
  returnOriginalTotal,
  returnItemsTotal,
  returnDiscount,
  returnFee,
  returnNetTotal,
  purchaseItemsTotal,
  purchaseDiscount,
  purchaseNetTotal,
  customerOwes,
  amountPaid,
  paymentMethod,
  onPaymentMethodChange,
  onAmountPaidChange,
  refundTransactionRef,
  onRefundTransactionRefChange,
  formatMoney,
  isSubmitting,
  canSubmit,
  onSubmit,
}) {
  const displayCustomerOwes = Math.max(0, customerOwes)
  const displayCustomerRefund = customerOwes < 0 ? Math.abs(customerOwes) : 0
  const isRefundFlow = displayCustomerRefund > 0
  const isPayFlow = displayCustomerOwes > 0
  const isSettled = !isRefundFlow && !isPayFlow

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-[#c1c9c0] bg-white xl:w-[min(100%,380px)] xl:border-l xl:border-t-0">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <p className="text-sm font-bold text-slate-800">{customerName || 'Khách lẻ'}</p>
          {customerPhone ? <p className="text-xs text-slate-500">{customerPhone}</p> : null}
          <p className="mt-1 text-xs text-slate-500">{createdAtLabel}</p>
          <p className="mt-1 text-xs font-semibold text-[#356647]">
            Trả hàng / {sourceOrderCode}
          </p>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Trả hàng</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Tổng giá gốc hàng mua</dt>
              <dd className="font-medium text-slate-800">{formatMoney(returnOriginalTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Tổng tiền hàng trả</dt>
              <dd className="font-medium text-slate-800">{formatMoney(returnItemsTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Giảm giá</dt>
              <dd className="text-slate-800">{formatMoney(returnDiscount)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Phí trả hàng</dt>
              <dd className="text-slate-800">{formatMoney(returnFee)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-1.5 font-semibold">
              <dt className="text-slate-700">Tổng tiền trả</dt>
              <dd className="text-slate-900">{formatMoney(returnNetTotal)}</dd>
            </div>
          </dl>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Mua hàng</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Tổng tiền hàng</dt>
              <dd className="font-medium text-slate-800">{formatMoney(purchaseItemsTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Giảm giá</dt>
              <dd className="text-slate-800">{formatMoney(purchaseDiscount)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-1.5 font-semibold">
              <dt className="text-slate-700">Tổng tiền mua</dt>
              <dd className="text-slate-900">{formatMoney(purchaseNetTotal)}</dd>
            </div>
          </dl>
        </section>

        <section className="mb-4 rounded-lg bg-[#f6f4ec] p-3">
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-700">
              {isRefundFlow ? 'Hoàn lại khách' : isPayFlow ? 'Khách cần trả' : 'Chênh lệch'}
            </span>
            <span className="text-lg font-bold text-[#356647]">
              {isSettled ? '0' : formatMoney(isRefundFlow ? displayCustomerRefund : displayCustomerOwes)}
            </span>
          </div>
          {isSettled ? (
            <p className="mt-2 text-xs text-slate-500">Trả đủ giá trị hàng — không phát sinh tiền mặt/CK.</p>
          ) : null}
        </section>

        {isRefundFlow ? (
          <section className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Hình thức hoàn tiền</p>
            <PaymentMethodPicker paymentMethod={paymentMethod} onPaymentMethodChange={onPaymentMethodChange} />
            {paymentMethod === 'CASH' ? (
              <p className="mt-2 text-xs text-slate-500">Trả tiền mặt trực tiếp cho khách tại quầy.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">
                  Chuyển khoản thủ công qua app ngân hàng — hệ thống chỉ ghi nhận, không tự chuyển tiền.
                </p>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">Mã giao dịch / ghi chú CK</span>
                  <input
                    type="text"
                    value={refundTransactionRef}
                    onChange={(e) => onRefundTransactionRefChange(e.target.value)}
                    placeholder="VD: FT25234... hoặc STK đã chuyển"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#356647]"
                  />
                </label>
              </div>
            )}
          </section>
        ) : null}

        {isPayFlow ? (
          <section className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Thanh toán thêm</p>
            <PaymentMethodPicker paymentMethod={paymentMethod} onPaymentMethodChange={onPaymentMethodChange} />
            {paymentMethod === 'TRANSFER' ? (
              <p className="mt-2 text-xs text-slate-500">
                Sau khi xác nhận trả hàng, hệ thống mở màn <strong>mã QR</strong> để khách quét chuyển khoản (giống bán hàng).
              </p>
            ) : (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-600">Khách thanh toán</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountPaid}
                  onChange={(e) => onAmountPaidChange(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-[#356647]"
                />
              </div>
            )}
          </section>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4">
        <button
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmit}
          className="w-full rounded-lg bg-[#356647] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#2d553c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Đang xử lý...' : 'Trả hàng'}
        </button>
      </div>
    </aside>
  )
}
