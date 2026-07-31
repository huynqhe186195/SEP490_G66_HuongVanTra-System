import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { fetchB2BDebts } from '../services/ordersApi.js'
import { formatVnd } from '../utils/orderDisplay.js'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('vi-VN')
}

function getDaysUntilDue(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function DueChip({ dueDate, daysOverdue }) {
  if (daysOverdue > 0) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Quá hạn {daysOverdue} ngày
      </span>
    )
  }

  const daysLeft = getDaysUntilDue(dueDate)
  if (daysLeft === null) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Không hạn</span>
  }
  if (daysLeft <= 7) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Còn {daysLeft} ngày
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[#e8f0e9] px-2 py-0.5 text-xs font-semibold text-[#356647]">
      Trong hạn
    </span>
  )
}

function B2BDebtsPage() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [overdueOnly, setOverdueOnly] = useState(false)

  const load = useCallback(
    async (p = 1) => {
      setIsLoading(true)
      try {
        const result = await fetchB2BDebts({ overdueOnly, page: p, pageSize: TABLE_PAGE_SIZE })
        setItems(result.items)
        setTotalItems(result.totalItems)
        setPage(p)
      } catch (err) {
        showError(err?.message ?? 'Không tải được danh sách công nợ doanh nghiệp.')
      } finally {
        setIsLoading(false)
      }
    },
    [overdueOnly],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => load(1), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const totalRemaining = items.reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Công nợ doanh nghiệp"
        titleInfo="Theo dõi các đơn bán theo hợp đồng còn nợ và hạn thanh toán."
      />

      <div className="flex flex-wrap items-center gap-4 p-4 pb-0">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="accent-[#356647]"
          />
          Chỉ hiện quá hạn
        </label>
        <span className="text-sm text-[#717971]">
          Tổng còn nợ trang này: <strong className="text-[#1b1c17]">{formatVnd(totalRemaining)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[#c1c9c0] text-left text-xs font-semibold text-[#717971]">
              <th className="pb-2 pr-4">Mã đơn</th>
              <th className="pb-2 pr-4">Khách hàng</th>
              <th className="pb-2 pr-4">Mã hợp đồng</th>
              <th className="pb-2 pr-4 text-right">Tổng tiền</th>
              <th className="pb-2 pr-4 text-right">Đã trả</th>
              <th className="pb-2 pr-4 text-right">Còn nợ</th>
              <th className="pb-2 pr-4">Hạn thanh toán</th>
              <th className="pb-2 pr-4">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-[#717971]">
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-[#717971]">
                  {overdueOnly ? 'Không có đơn nào quá hạn thanh toán.' : 'Chưa có công nợ doanh nghiệp nào.'}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.orderId} className="border-b border-[#f0f4f0] last:border-0 hover:bg-[#f5f7f4]">
                  <td className="py-3 pr-4">
                    <Link className="font-semibold text-[#356647] hover:underline" to={`/orders/${row.orderId}`}>
                      {row.orderCode || '—'}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-[#1b1c17]">{row.customerSnapshotName || '—'}</td>
                  <td className="py-3 pr-4 text-[#414942]">{row.contractCodeSnapshot || '—'}</td>
                  <td className="py-3 pr-4 text-right text-[#414942]">{formatVnd(row.finalAmount)}</td>
                  <td className="py-3 pr-4 text-right text-[#414942]">{formatVnd(row.paidAmount)}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-[#1b1c17]">
                    {formatVnd(row.remainingAmount)}
                  </td>
                  <td className="py-3 pr-4 text-[#414942]">{formatDate(row.dueDate)}</td>
                  <td className="py-3 pr-4">
                    <DueChip dueDate={row.dueDate} daysOverdue={row.daysOverdue} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalItems > TABLE_PAGE_SIZE ? (
          <TablePagination
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            totalCount={totalItems}
            disabled={isLoading}
            itemLabel="đơn nợ"
            onPageChange={(p) => load(p)}
          />
        ) : null}
      </div>
    </PageShell>
  )
}

export default B2BDebtsPage
