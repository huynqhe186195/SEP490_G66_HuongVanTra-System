import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOrder } from '../../orders/services/ordersApi.js'
import { getOrderStatusLabel, getOrderStatusClass } from '../../orders/utils/orderDisplay.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../utils/cashReportLabels.js'
import { formatVnd } from '../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-[#717971]">{label}</span>
      <span className={`text-sm ${strong ? 'font-bold text-[#1b1c17]' : 'text-[#414942]'}`}>{value}</span>
    </div>
  )
}

/** Ngăn kéo chi tiết đơn, mở từ bảng đơn trong tab Bán hàng và tab Ngoại lệ. */
function OrderDetailDrawer({ orderId, orderCode, onClose }) {
  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orderId) return undefined
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchOrder(orderId)
        if (!cancelled) setOrder(data)
      } catch (err) {
        if (!cancelled) setError('Không tải được chi tiết đơn: ' + err.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!orderId) return null

  const paid = (order?.payments || [])
    .filter((p) => p.paymentStatus === 'Success')
    .reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end [font-family:'Manrope',sans-serif]">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#c1c9c0]/60 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#717971]">Chi tiết đơn</p>
            <h2 className="font-mono text-lg font-bold text-[#356647]">{order?.orderCode || orderCode}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#717971] hover:bg-[#f6f4ec]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
          {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[#f6f4ec]" />}

          {error && (
            <p className="rounded-xl border border-[#b42318]/40 bg-[#b42318]/5 p-3 text-sm text-[#b42318]">{error}</p>
          )}

          {order && !isLoading && (
            <>
              <section className="rounded-2xl border border-[#c1c9c0]/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                    {getOrderStatusLabel(order.orderStatus)}
                  </span>
                  <span className="text-xs text-[#717971]">{formatVietnamDateTimeMinute(order.createdAt)}</span>
                </div>
                <Row label="Khách hàng" value={order.customerSnapshotName || 'Khách lẻ'} />
                <Row label="Nhân viên bán" value={order.sellerName || '—'} />
                <Row label="Kênh bán" value={order.orderChannel || '—'} />
                {order.pickupDate && (
                  <Row label="Ngày hẹn nhận" value={formatVietnamDateTimeMinute(order.pickupDate)} />
                )}
                {order.shippingAddress && <Row label="Địa chỉ giao" value={order.shippingAddress} />}
                {order.note && <Row label="Ghi chú" value={order.note} />}
              </section>

              <section className="rounded-2xl border border-[#c1c9c0]/40 p-4">
                <h3 className="mb-2 text-sm font-bold text-[#1b1c17]">Hàng hóa ({order.items.length} dòng)</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#c1c9c0]/60 text-xs uppercase text-[#717971]">
                      <th className="py-1.5">Mặt hàng</th>
                      <th className="py-1.5 text-center">SL</th>
                      <th className="py-1.5 text-right">Đơn giá</th>
                      <th className="py-1.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c1c9c0]/30">
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2">
                          <p className="font-medium text-[#1b1c17]">{it.skuSnapshotName}</p>
                          <p className="font-mono text-[11px] text-[#717971]">{it.skuSnapshotCode}</p>
                          {it.returnedQuantity > 0 && (
                            <p className="text-[11px] font-semibold text-[#b42318]">Đã trả {it.returnedQuantity}</p>
                          )}
                          {it.isGift && <p className="text-[11px] text-[#7e5700]">Hàng tặng</p>}
                        </td>
                        <td className="py-2 text-center">{it.quantity}</td>
                        <td className="py-2 text-right">{formatVnd(it.unitPrice)}</td>
                        <td className="py-2 text-right font-semibold">{formatVnd(it.subTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl border border-[#c1c9c0]/40 p-4">
                <h3 className="mb-2 text-sm font-bold text-[#1b1c17]">Tiền hàng</h3>
                <Row label="Tạm tính" value={formatVnd(order.totalAmount)} />
                <Row label="Giảm giá" value={formatVnd(order.discountAmount)} />
                <Row label="Thành tiền" value={formatVnd(order.finalAmount)} strong />
                <Row label="Đã thu" value={formatVnd(paid)} />
                {paid < order.finalAmount && (
                  <p className="mt-2 rounded-lg bg-[#b42318]/5 px-3 py-2 text-xs font-semibold text-[#b42318]">
                    Còn thiếu {formatVnd(order.finalAmount - paid)}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-[#c1c9c0]/40 p-4">
                <h3 className="mb-2 text-sm font-bold text-[#1b1c17]">Các lần thu ({order.payments.length})</h3>
                {order.payments.length === 0 ? (
                  <p className="text-sm text-[#717971]">Chưa có khoản thu nào.</p>
                ) : (
                  <ul className="divide-y divide-[#c1c9c0]/30">
                    {order.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-[#1b1c17]">
                            {paymentMethodLabel(p.paymentMethod)} · {paymentPurposeLabel(p.paymentPurpose)}
                          </p>
                          <p className="text-xs text-[#717971]">
                            {p.paidAt ? formatVietnamDateTimeMinute(p.paidAt) : 'Chưa thu'} · {p.paymentStatus}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            p.paymentStatus === 'Success' ? 'text-[#356647]' : 'text-[#717971]'
                          }`}
                        >
                          {formatVnd(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="border-t border-[#c1c9c0]/60 px-5 py-3">
          <Link
            to={`/orders/${orderId}`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a5238]"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Mở trang đơn hàng đầy đủ
          </Link>
        </footer>
      </aside>
    </div>
  )
}

export default OrderDetailDrawer
