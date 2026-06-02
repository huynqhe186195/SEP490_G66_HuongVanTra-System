function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function PaymentReceiptModal({ isOpen, receipt, onClose, onPrint }) {
  if (!isOpen || !receipt) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="border-b border-[#e5e7eb] bg-[#356647] px-5 py-4 text-white">
          <h2 className="text-lg font-bold">Hóa đơn thanh toán</h2>
          <p className="text-xs text-white/80">Mã đơn: {receipt.orderCode || '—'}</p>
        </header>

        <main className="space-y-4 bg-[#fbf9f1] p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-[#717971]">Khách hàng</p>
              <p className="mt-1 font-semibold text-[#1b1c17]">{receipt.customerName || 'Khách lẻ'}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-[#717971]">Người bán</p>
              <p className="mt-1 font-semibold text-[#1b1c17]">{receipt.sellerName || 'Nhân viên POS'}</p>
              {receipt.sellerRole ? (
                <p className="mt-0.5 text-xs font-medium text-[#356647]">{receipt.sellerRole}</p>
              ) : null}
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-[#717971]">Phương thức</p>
              <p className="mt-1 font-semibold text-[#1b1c17]">{receipt.paymentMethodLabel}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-[#717971]">Thời gian</p>
              <p className="mt-1 font-semibold text-[#1b1c17]">{receipt.createdAtLabel}</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f6f4ec] text-xs uppercase text-[#717971]">
                <tr>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => (
                  <tr key={item.sku} className="border-t border-[#f0eee6]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1b1c17]">{item.name}</p>
                      <p className="text-xs text-[#717971]">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{item.qty}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(item.price)} đ</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#356647]">{formatMoney(item.total)} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl bg-white p-4 text-sm">
            <div className="space-y-1.5 text-[#414942]">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span>{formatMoney(receipt.grossSubtotal)} đ</span>
              </div>
              <div className="flex justify-between">
                <span>Chiết khấu</span>
                <span>-{formatMoney(receipt.totalDiscount)} đ</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#f0eee6] pt-2 text-base font-bold text-[#1b1c17]">
                <span>Tổng thanh toán</span>
                <span className="text-[#356647]">{formatMoney(receipt.total)} đ</span>
              </div>
              {receipt.paymentMethodLabel === 'Tiền mặt' ? (
                <>
                  <div className="flex justify-between">
                    <span>Khách trả</span>
                    <span>{formatMoney(receipt.customerPaid ?? receipt.amountPaid ?? 0)} đ</span>
                  </div>
                  {(receipt.debtAmount ?? 0) > 0 ? (
                    <div className="flex justify-between font-semibold text-[#7e5700]">
                      <span>Dư nợ</span>
                      <span>{formatMoney(receipt.debtAmount)} đ</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-semibold text-[#356647]">
                    <span>Tiền thừa</span>
                    <span>{(receipt.change ?? 0) > 0 ? `${formatMoney(receipt.change)} đ` : '—'}</span>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </main>

        <footer className="flex justify-end gap-3 border-t border-[#e5e7eb] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#c1c9c0] px-5 py-2 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]">
            Cancel
          </button>
          <button type="button" onClick={onPrint} className="rounded-lg bg-[#356647] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4e7f5e]">
            In hóa đơn
          </button>
        </footer>
      </div>
    </div>
  )
}

export default PaymentReceiptModal
