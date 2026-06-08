import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateOrder } from '../../auth/utils/permissions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderTimeline from '../components/OrderTimeline.jsx'
import {
  cancelOrder,
  completeOrder,
  fetchOrder,
  shipOrder,
  updateOrder,
  verifyCodPayment,
} from '../services/ordersApi.js'
import {
  canCancelOrder,
  canCompleteOrder,
  canEditOrderMeta,
  canShipOrder,
  canVerifyCod,
  formatVnd,
  getInventorySyncClass,
  getInventorySyncLabel,
  getOrderChannelLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  getPrimaryPayment,
} from '../utils/orderDisplay.js'

function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canManage = canCreateOrder(loadAuthSession())

  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [shippingAddress, setShippingAddress] = useState('')
  const [note, setNote] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [codRef, setCodRef] = useState('')
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)

  const loadOrder = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await fetchOrder(id)
      setOrder(data)
      setShippingAddress(data.shippingAddress || '')
      setNote(data.note || '')
      setDiscountAmount(String(data.discountAmount ?? ''))
    } catch (error) {
      setOrder(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  async function handleSaveMeta(event) {
    event.preventDefault()
    if (!canManage || !order) return
    try {
      setIsSaving(true)
      const updated = await updateOrder(order.id, {
        shippingAddress,
        note,
        discountAmount: Number(discountAmount || 0),
      })
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess('Đã cập nhật đơn hàng.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function runAction(action) {
    if (!canManage || !order) return
    try {
      setIsSaving(true)
      if (action === 'ship') {
        await shipOrder(order.id)
        showSuccess('Đã chuyển sang trạng thái đang giao.')
      } else if (action === 'complete') {
        await completeOrder(order.id)
        showSuccess('Đã hoàn tất đơn hàng.')
      } else if (action === 'cancel') {
        if (!window.confirm('Hủy đơn hàng này?')) return
        await cancelOrder(order.id)
        showSuccess('Đã hủy đơn hàng.')
      } else if (action === 'verify-cod') {
        const payment = getPrimaryPayment(order)
        if (!payment) return
        await verifyCodPayment(payment.id, codRef)
        showSuccess('Đã xác nhận thu COD.')
      }
      await loadOrder()
      setTimelineRefreshKey((key) => key + 1)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-1 py-10 text-slate-500 sm:px-2">
          Đang tải đơn hàng...
        </div>
      </PageShell>
    )
  }

  if (!order) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-1 py-10 sm:px-2">
          <p className="text-slate-500">Không tìm thấy đơn hàng.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#538463]" to="/orders">
            ← Quay lại danh sách
          </Link>
        </div>
      </PageShell>
    )
  }

  const payment = getPrimaryPayment(order)

  return (
    <PageShell>
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 pb-8 sm:px-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-[#538463] hover:underline" to="/orders">
            ← Danh sách đơn
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{order.orderCode}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {getOrderChannelLabel(order.orderChannel)} · Tạo lúc {formatVietnamDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
            {getOrderStatusLabel(order.orderStatus)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getInventorySyncClass(order.inventorySyncStatus)}`}>
            {getInventorySyncLabel(order.inventorySyncStatus)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800">Sản phẩm</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">SKU / Tên</th>
                  <th className="pb-3 pr-4">SL</th>
                  <th className="pb-3 pr-4">Đơn giá</th>
                  <th className="pb-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.items.map((line) => (
                  <tr key={line.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-800">{line.skuSnapshotName}</p>
                      {line.skuSnapshotCode ? (
                        <p className="font-mono text-xs text-slate-500">{line.skuSnapshotCode}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">{line.quantity}</td>
                    <td className="py-3 pr-4">{formatVnd(line.unitPrice)}</td>
                    <td className="py-3 text-right font-semibold">{formatVnd(line.subTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Tạm tính</span>
              <span>{formatVnd(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Giảm giá</span>
              <span>-{formatVnd(order.discountAmount)}</span>
            </div>
            <div className="flex justify-between py-2 text-base font-bold text-[#356647]">
              <span>Thành tiền</span>
              <span>{formatVnd(order.finalAmount)}</span>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Khách hàng</h2>
            <p className="font-semibold text-slate-800">{order.customerSnapshotName || 'Khách lẻ'}</p>
            {order.shippingAddress ? (
              <p className="mt-2 text-sm text-slate-600">{order.shippingAddress}</p>
            ) : null}
          </section>

          {payment ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thanh toán</h2>
              <p className="text-sm text-slate-700">{getPaymentMethodLabel(payment.paymentMethod)}</p>
              <p className="mt-1 text-sm font-semibold">{formatVnd(payment.amount)}</p>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(payment.paymentStatus)}`}>
                {getPaymentStatusLabel(payment.paymentStatus)}
              </span>
              {payment.isCodVerified ? (
                <p className="mt-2 text-xs text-emerald-700">COD đã xác nhận</p>
              ) : null}
            </section>
          ) : null}

          {canManage ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thao tác</h2>
              <div className="flex flex-col gap-2">
                {canShipOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runAction('ship')}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Chuyển sang đang giao
                  </button>
                ) : null}
                {canCompleteOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runAction('complete')}
                    className="rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                  >
                    Hoàn tất đơn
                  </button>
                ) : null}
                {canVerifyCod(order) ? (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">Xác nhận thu COD</p>
                    <input
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                      placeholder="Mã tham chiếu (tuỳ chọn)"
                      value={codRef}
                      onChange={(e) => setCodRef(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => runAction('verify-cod')}
                      className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      Đã giao &amp; thu tiền
                    </button>
                  </div>
                ) : null}
                {canCancelOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runAction('cancel')}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Hủy đơn
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Lịch sử xử lý</h2>
        <OrderTimeline orderId={order.id} refreshKey={timelineRefreshKey} />
      </section>

      {canManage && canEditOrderMeta(order) ? (
        <form className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" onSubmit={handleSaveMeta}>
          <h2 className="mb-4 text-lg font-bold text-slate-800">Cập nhật thông tin</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Địa chỉ giao hàng</span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Ghi chú</span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Giảm giá (VND)</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                inputMode="decimal"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
              onClick={() => navigate('/orders')}
            >
              Quay lại
            </button>
          </div>
        </form>
      ) : null}
    </div>
    </PageShell>
  )
}

export default OrderDetailPage
