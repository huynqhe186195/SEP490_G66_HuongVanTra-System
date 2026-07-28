import { useEffect, useState } from 'react'
import LoadingIndicator from '../../../components/shared/LoadingIndicator.jsx'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  fetchOrderCodReservations,
  reservationStatusLabel,
} from '../../inventory/services/stockDeductQueueApi.js'

const STATUS_CLASS = {
  Active: 'bg-amber-100 text-amber-800',
  Released: 'bg-slate-100 text-slate-600',
  Deducted: 'bg-emerald-100 text-emerald-700',
  None: 'bg-slate-100 text-slate-500',
}

function statusClass(status) {
  return STATUS_CLASS[String(status || '')] || 'bg-slate-100 text-slate-500'
}

function OrderStockReservationSection({ orderId, refreshKey = 0 }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return undefined
    let mounted = true
    setIsLoading(true)

    fetchOrderCodReservations(orderId)
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch(() => {
        if (mounted) setData(null)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [orderId, refreshKey])

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Giữ chỗ tồn Kệ Hàng</h2>
        <LoadingIndicator />
      </section>
    )
  }

  if (!data || data.lines.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800">Giữ chỗ tồn Kệ Hàng</h2>
        {data.hasActiveReservation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
            Đang giữ hàng · {data.totalActiveReservedQuantity}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Không còn giữ chỗ
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã SKU</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Tên sản phẩm</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">
                SL đặt
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">
                SL đang giữ
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Trạng thái</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Giữ lúc</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">
                Giải phóng / Xuất kho
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.lines.map((line) => (
              <tr key={line.skuId} className="align-top">
                <td className="px-4 py-3 font-semibold text-slate-700" title={line.skuId}>
                  {line.skuCode || '—'}
                </td>
                <td className="px-4 py-3 text-slate-700">{line.skuName || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-700">{line.orderedQuantity}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  {line.reservationStatus === 'Active' ? line.reservedQuantity : 0}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(line.reservationStatus)}`}
                  >
                    {reservationStatusLabel(line.reservationStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {line.reservedAt ? formatVietnamDateTime(line.reservedAt) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {line.deductedAt
                    ? `Xuất kho: ${formatVietnamDateTime(line.deductedAt)}`
                    : line.releasedAt
                      ? `Giải phóng: ${formatVietnamDateTime(line.releasedAt)}`
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default OrderStockReservationSection
