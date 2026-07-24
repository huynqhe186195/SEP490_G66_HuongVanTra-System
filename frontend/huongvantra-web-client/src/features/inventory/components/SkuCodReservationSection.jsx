import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchSkuCodReservations, reservationStatusLabel } from '../services/stockDeductQueueApi.js'

const ORDER_STATUS_LABELS = {
  draft: 'Nháp',
  pendingpayment: 'Chờ thanh toán',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[String(status || '').toLowerCase()] || status || '—'
}

/** POS-04 (truy vết giữ chỗ): danh sách đơn COD đang giữ chỗ tồn Kệ Hàng của một SKU. */
function SkuCodReservationSection({ skuId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!skuId) {
      setData(null)
      return undefined
    }

    let mounted = true
    fetchSkuCodReservations(skuId)
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch(() => {
        if (mounted) setData(null)
      })

    return () => {
      mounted = false
    }
  }, [skuId])

  if (!data || data.orders.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
        <span className="material-symbols-outlined text-[18px] text-amber-700">inventory_2</span>
        <h4 className="text-sm font-bold text-amber-900">Đơn hàng đang giữ chỗ</h4>
        <span className="text-xs font-semibold text-amber-800">
          Tổng đang giữ: {data.totalActiveReservedQuantity}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Mã đơn</th>
              <th className="px-4 py-2.5">Khách hàng</th>
              <th className="px-4 py-2.5 text-right">SL giữ</th>
              <th className="px-4 py-2.5">Giữ lúc</th>
              <th className="px-4 py-2.5">Trạng thái đơn</th>
              <th className="px-4 py-2.5">Trạng thái giữ chỗ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.orders.map((row) => (
              <tr key={row.orderId}>
                <td className="px-4 py-2.5 font-semibold" title={row.orderId}>
                  <Link to={`/orders/${row.orderId}?from=cod`} className="text-[#356647] hover:underline">
                    {row.orderCode || row.orderId}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{row.customerSnapshotName || '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{row.reservedQuantity}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {row.reservedAt ? formatVietnamDateTime(row.reservedAt) : '—'}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{orderStatusLabel(row.orderPaymentStatus)}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {reservationStatusLabel(row.reservationStatus)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SkuCodReservationSection
