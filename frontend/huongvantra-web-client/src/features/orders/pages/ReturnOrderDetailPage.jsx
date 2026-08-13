import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { acceptReturn, fetchReturnById, rejectReturn } from '../services/ordersApi.js'
import { formatVnd, getPaymentMethodLabel } from '../utils/orderDisplay.js'

function statusLabel(status) {
  const key = String(status || '').toUpperCase()
  if (key === 'PENDING') return { text: 'Chờ Accept', className: 'bg-amber-100 text-amber-800' }
  if (key === 'REJECTED') return { text: 'Từ chối', className: 'bg-rose-100 text-rose-800' }
  return { text: 'Đã Accept', className: 'bg-emerald-100 text-emerald-800' }
}

function ReturnOrderDetailPage() {
  const { id } = useParams()
  const authSession = useAuthSession()
  const canManageAcceptance = canViewAllOrders(authSession)
  const [item, setItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)

  const loadReturn = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await fetchReturnById(id)
      setItem(data)
    } catch (error) {
      setItem(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadReturn()
  }, [loadReturn])

  const handleAccept = async () => {
    if (!item?.id) return
    setIsActing(true)
    try {
      const result = await acceptReturn(item.id)
      showSuccess(
        result.refundAmount > 0
          ? `Đã Accept ${result.returnCode}: hoàn ${formatVnd(result.refundAmount)}.`
          : `Đã Accept ${result.returnCode}.`,
      )
      await loadReturn()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsActing(false)
    }
  }

  const handleReject = async () => {
    if (!item?.id) return
    const reason = window.prompt('Lý do từ chối phiếu trả (tuỳ chọn):') ?? ''
    if (reason === null) return
    setIsActing(true)
    try {
      await rejectReturn(item.id, reason)
      showSuccess(`Đã từ chối ${item.returnCode}.`)
      await loadReturn()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <p className="text-slate-500">Đang tải phiếu trả...</p>
      </PageShell>
    )
  }

  if (!item) {
    return (
      <PageShell>
        <p className="text-slate-600">Không tìm thấy phiếu trả hàng.</p>
        <Link to="/orders/exchange?tab=returns" className="mt-3 inline-block text-[#356647] hover:underline">
          ← Trả / đổi hàng
        </Link>
      </PageShell>
    )
  }

  const status = statusLabel(item.acceptanceStatus)
  const isPending = String(item.acceptanceStatus || '').toUpperCase() === 'PENDING'

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/orders/exchange?tab=returns" className="text-sm font-semibold text-[#538463] hover:underline">
              ← Trả / đổi hàng
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{item.returnCode}</h1>
            <p className="mt-1 text-sm text-slate-500">Tạo lúc {formatVietnamDateTime(item.createdAt)}</p>
            {item.acceptedAt ? (
              <p className="mt-0.5 text-sm text-slate-500">Accept lúc {formatVietnamDateTime(item.acceptedAt)}</p>
            ) : null}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.text}</span>
        </div>

        {isPending && canManageAcceptance ? (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="w-full text-sm text-amber-900">
              Phiếu đang chờ Accept — chưa hoàn tiền, chưa tạo ReturnInspection.
            </p>
            <button
              type="button"
              disabled={isActing}
              onClick={handleAccept}
              className="rounded-lg bg-[#356647] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={isActing}
              onClick={handleReject}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
            >
              Từ chối
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Hàng trả</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-2 pr-4">Sản phẩm</th>
                    <th className="pb-2 pr-4">SL</th>
                    <th className="pb-2 pr-4">Đơn giá</th>
                    <th className="pb-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {item.items.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-900">{line.skuSnapshotName}</p>
                        {line.skuSnapshotCode ? (
                          <p className="font-mono text-xs text-slate-500">{line.skuSnapshotCode}</p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">{line.returnQuantity}</td>
                      <td className="py-2 pr-4">{formatVnd(line.unitPrice)}</td>
                      <td className="py-2 text-right font-semibold">{formatVnd(line.subTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Tiền hàng trả</span>
                <span className="font-semibold">{formatVnd(item.returnAmount)}</span>
              </div>
              {item.exchangeAmount > 0 ? (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Tiền hàng đổi/mua thêm</span>
                  <span>{formatVnd(item.exchangeAmount)}</span>
                </div>
              ) : null}
              {item.netCustomerPays > 0 ? (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Khách trả thêm</span>
                  <span className="font-semibold text-amber-700">{formatVnd(item.netCustomerPays)}</span>
                </div>
              ) : null}
              {item.refundAmount > 0 ? (
                <div className="flex justify-between py-2 text-base font-bold text-[#356647]">
                  <span>Hoàn cho khách</span>
                  <span>{formatVnd(item.refundAmount)}</span>
                </div>
              ) : null}
            </div>

            {item.evidenceImageUrls?.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Ảnh minh chứng</h3>
                <div className="flex flex-wrap gap-2">
                  {item.evidenceImageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-md border">
                      <img src={url} alt="Minh chứng" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Hóa đơn gốc</h2>
              <Link to={`/orders/${item.sourceOrderId}`} className="font-mono text-lg font-bold text-[#356647] hover:underline">
                {item.sourceOrderCode}
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Khách hàng</h2>
              <OrderCustomerCell snapshot={item.customerSnapshotName} customerId={item.customerId} />
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thanh toán</h2>
              <p className="text-sm text-slate-700">{getPaymentMethodLabel(item.refundMethod)}</p>
              {item.customerPaidAmount > 0 ? (
                <p className="mt-1 text-sm font-semibold">Đã thu: {formatVnd(item.customerPaidAmount)}</p>
              ) : null}
              {item.policyCode ? (
                <p className="mt-2 text-xs text-slate-500">
                  Policy {item.policyCode}
                  {item.policyVersion != null ? ` v${item.policyVersion}` : ''}
                  {item.acceptedBySystem ? ' · System' : ''}
                  {item.managerOverride ? ' · Override' : ''}
                </p>
              ) : null}
            </section>

            {item.exchangeOrderCode ? (
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Đơn đổi</h2>
                <Link
                  to={`/orders/${item.exchangeOrderId}?from=exchange`}
                  className="font-mono text-lg font-bold text-[#356647] hover:underline"
                >
                  {item.exchangeOrderCode}
                </Link>
              </section>
            ) : null}

            {item.rejectionReason?.trim() ? (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-rose-400">Lý do từ chối</h2>
                <p className="whitespace-pre-wrap text-sm text-rose-900">{item.rejectionReason}</p>
              </section>
            ) : null}

            {item.note?.trim() ? (
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Ghi chú</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{item.note}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </PageShell>
  )
}

export default ReturnOrderDetailPage
