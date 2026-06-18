import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function SummaryRow({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'discount' ? 'text-[#356647]' : tone === 'total' ? 'text-[#1b1c17]' : 'text-[#717971]'

  return (
    <div className={`flex items-center justify-between gap-3 ${toneClass}`}>
      <span>{label}</span>
      <span className={tone === 'total' ? 'text-lg font-bold text-[#356647]' : 'font-semibold'}>
        {value}
      </span>
    </div>
  )
}

export default function PosPaymentConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  formatMoney,
  cartItemLines = [],
  grossSubtotal = 0,
  itemDiscountTotal = 0,
  orderDiscountAmount = 0,
  orderDiscountPercent = 0,
  usesFixedOrderDiscount = false,
  couponDiscountAmount = 0,
  membershipDiscountAmount = 0,
  totalDiscount = 0,
  total = 0,
  selectedCustomer = null,
  paymentMethodLabel = '',
  appliedPromotion = null,
  appliedPromotionScopeText = '',
  orderNote = '',
}) {
  if (!isOpen) return null

  const note = orderNote?.trim()
  const customerName = selectedCustomer?.fullName || selectedCustomer?.customerSnapshotName || 'Khách lẻ'
  const customerMeta = [selectedCustomer?.phone, selectedCustomer?.customerCode].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-5">
      <div className="flex max-h-[calc(100vh-32px)] min-h-0 w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#f0eee6] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Xác nhận trước khi thanh toán</p>
            <h2 className="mt-1 text-xl font-bold text-[#1b1c17]">Kiểm tra đơn hàng</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-[#717971] hover:bg-[#f6f4ec] disabled:opacity-50"
            aria-label="Đóng"
          >
            <Icon className="text-[22px]">close</Icon>
          </button>
        </header>

        <CustomScrollArea className="min-h-0 flex-1" contentClassName="min-h-0 px-5 py-4">
          <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex min-h-0 flex-col rounded-xl border border-[#f0eee6]">
              <div className="flex shrink-0 items-center justify-between border-b border-[#f0eee6] px-4 py-3">
                <h3 className="text-sm font-bold text-[#1b1c17]">Sản phẩm</h3>
                <span className="text-xs text-[#717971]">{cartItemLines.length} mặt hàng</span>
              </div>
              <CustomScrollArea
                className="min-h-0 max-h-[min(42vh,360px)]"
                contentClassName="max-h-[min(42vh,360px)] pr-3"
                allowHorizontalScroll
              >
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-auto" />
                    <col className="w-10" />
                    <col className="w-[96px]" />
                    <col className="w-[116px]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-[#fbf9f1] text-xs uppercase tracking-wide text-[#717971]">
                    <tr>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="whitespace-nowrap px-1 py-2 text-center">SL</th>
                      <th className="whitespace-nowrap px-1.5 py-2 text-right">Đơn giá</th>
                      <th className="whitespace-nowrap px-2 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0eee6]">
                    {cartItemLines.map((line) => (
                      <tr key={line.key}>
                        <td className="min-w-0 px-3 py-3">
                          <p className="line-clamp-2 font-semibold leading-snug text-[#1b1c17]" title={line.name}>
                            {line.name}
                          </p>
                          {line.discountLabel ? (
                            <p className="mt-1 text-xs font-semibold text-[#7e5700]">CK dòng {line.discountLabel}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-1 py-3 text-center tabular-nums">{line.qty}</td>
                        <td className="whitespace-nowrap px-1.5 py-3 text-right tabular-nums">{formatMoney(line.unitPrice)} đ</td>
                        <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums text-[#1b1c17]">
                          {formatMoney(line.lineTotal)} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CustomScrollArea>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-[#f0eee6] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Khách hàng</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{customerName}</p>
                {customerMeta ? <p className="mt-0.5 text-xs text-[#717971]">{customerMeta}</p> : null}
              </section>

              <section className="rounded-xl border border-[#f0eee6] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Thanh toán</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{paymentMethodLabel}</p>
              </section>

              {appliedPromotion ? (
                <section className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#356647]">Mã giảm giá</p>
                  <p className="mt-1 font-semibold text-[#1b1c17]">{appliedPromotion.promoCode}</p>
                  {appliedPromotionScopeText ? (
                    <p className="mt-1 text-xs text-[#717971]">{appliedPromotionScopeText}</p>
                  ) : null}
                </section>
              ) : null}

              {note ? (
                <section className="rounded-xl border border-[#f0eee6] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Ghi chú đơn hàng</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#1b1c17]">{note}</p>
                </section>
              ) : null}

              <section className="rounded-xl border border-[#f0eee6] p-4">
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Tạm tính" value={`${formatMoney(grossSubtotal)} đ`} />
                  {itemDiscountTotal > 0 ? (
                    <SummaryRow label="CK từng sản phẩm" value={`-${formatMoney(itemDiscountTotal)} đ`} tone="discount" />
                  ) : null}
                  {orderDiscountAmount > 0 ? (
                    <SummaryRow
                      label={usesFixedOrderDiscount ? 'CK đơn (VNĐ)' : `CK đơn (${orderDiscountPercent}%)`}
                      value={`-${formatMoney(orderDiscountAmount)} đ`}
                      tone="discount"
                    />
                  ) : null}
                  {couponDiscountAmount > 0 ? (
                    <SummaryRow
                      label={`Mã ${appliedPromotion?.promoCode || 'giảm giá'}`}
                      value={`-${formatMoney(couponDiscountAmount)} đ`}
                      tone="discount"
                    />
                  ) : null}
                  {membershipDiscountAmount > 0 ? (
                    <SummaryRow label="CK hạng khách" value={`-${formatMoney(membershipDiscountAmount)} đ`} tone="discount" />
                  ) : null}
                  {totalDiscount > 0 ? (
                    <SummaryRow label="Tổng giảm" value={`-${formatMoney(totalDiscount)} đ`} tone="discount" />
                  ) : null}
                  <div className="border-t border-[#f0eee6] pt-3">
                    <SummaryRow label="Cần thanh toán" value={`${formatMoney(total)} đ`} tone="total" />
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </CustomScrollArea>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#f0eee6] bg-[#fbf9f1] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
          >
            Quay lại chỉnh sửa
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        </footer>
      </div>
    </div>
  )
}
