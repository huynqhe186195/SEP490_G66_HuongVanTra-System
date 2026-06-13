import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchReturnById } from '../services/ordersApi.js'
import { formatVnd, getPaymentMethodLabel } from '../utils/orderDisplay.js'

function ReturnOrderDetailPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
        <div>
          <Link to="/orders/exchange?tab=returns" className="text-sm font-semibold text-[#538463] hover:underline">
            ← Trả / đổi hàng
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{item.returnCode}</h1>
          <p className="mt-1 text-sm text-slate-500">Tạo lúc {formatVietnamDateTime(item.createdAt)}</p>
        </div>

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
