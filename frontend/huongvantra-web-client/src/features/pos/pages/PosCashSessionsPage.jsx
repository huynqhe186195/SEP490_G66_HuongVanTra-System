import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchCashSessionHistory } from '../services/posCashSessionApi.js'

function formatVnd(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ'
}

function getStatusLabel(status) {
  if (status === 'Open') return 'Đang mở'
  if (status === 'Closed') return 'Đã đóng'
  return status || '—'
}

function getStatusClass(status) {
  if (status === 'Open') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'Closed') return 'bg-slate-100 text-slate-700 ring-slate-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function varianceClass(variance) {
  const value = Number(variance)
  if (!Number.isFinite(value) || value === 0) return 'text-slate-600'
  return value > 0 ? 'text-emerald-700' : 'text-rose-700'
}

function todayInput() {
  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return vn.toISOString().slice(0, 10)
}

function daysAgoInput(days) {
  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000)
  return vn.toISOString().slice(0, 10)
}

export default function PosCashSessionsPage() {
  const [from, setFrom] = useState(() => daysAgoInput(14))
  const [to, setTo] = useState(() => todayInput())
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchCashSessionHistory({
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        search: searchInput.trim() || undefined,
        page,
        pageSize,
      })
      setData(result)
    } catch (error) {
      setData({ items: [], totalItems: 0, totalPages: 1 })
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [from, to, status, searchInput, page, pageSize])

  useEffect(() => {
    const timer = window.setTimeout(load, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  function resetPageAndSet(setter, value) {
    setter(value)
    setPage(1)
  }

  return (
    <PageShell>
      <PageHeader
        title="Quỹ ca POS"
        titleInfo="Lịch sử mở/đóng quỹ tiền mặt tại quầy — theo dõi doanh thu tiền mặt, lệch quỹ theo ca."
        searchPlaceholder="Tìm người mở/đóng, tên ca, ghi chú..."
        searchValue={searchInput}
        onSearchChange={(value) => resetPageAndSet(setSearchInput, value)}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
          Từ ngày
          <input
            type="date"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            value={from}
            onChange={(event) => resetPageAndSet(setFrom, event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
          Đến ngày
          <input
            type="date"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            value={to}
            onChange={(event) => resetPageAndSet(setTo, event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
          Trạng thái
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            value={status}
            onChange={(event) => resetPageAndSet(setStatus, event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="Open">Đang mở</option>
            <option value="Closed">Đã đóng</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={load}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Làm mới
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Ca / mở</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Đầu ca</th>
                <th className="px-4 py-3 text-right">Thu TM</th>
                <th className="px-4 py-3 text-right">Hoàn TM</th>
                <th className="px-4 py-3 text-right">Đơn</th>
                <th className="px-4 py-3 text-right">Kỳ vọng</th>
                <th className="px-4 py-3 text-right">Đếm</th>
                <th className="px-4 py-3 text-right">Lệch</th>
                <th className="px-4 py-3">Đóng ca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={10} className="px-6 py-8 text-slate-500">Đang tải...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-8 text-slate-500">Chưa có ca quỹ phù hợp.</td></tr>
              ) : data.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{row.shiftLabel || 'Ca quỹ'}</p>
                    <p className="text-xs text-slate-500">
                      {row.openedByName || '—'} · {formatVietnamDateTime(row.openedAt)}
                    </p>
                    {row.note ? <p className="mt-1 text-xs text-slate-500">{row.note}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getStatusClass(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">{formatVnd(row.openingCash)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-emerald-700">{formatVnd(row.cashSalesTotal)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-rose-700">{formatVnd(row.cashRefundTotal)}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{row.orderCount}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{formatVnd(row.expectedCash)}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{row.countedCash == null ? '—' : formatVnd(row.countedCash)}</td>
                  <td className={`px-4 py-4 text-right tabular-nums font-semibold ${varianceClass(row.variance)}`}>
                    {row.variance == null ? '—' : formatVnd(row.variance)}
                    {row.varianceNote ? (
                      <p className="mt-1 text-left text-xs font-normal text-slate-500">{row.varianceNote}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {row.closedAt ? (
                      <>
                        <p>{row.closedByName || '—'}</p>
                        <p className="text-xs">{formatVietnamDateTime(row.closedAt)}</p>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={data.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="ca quỹ"
        />
      </section>
    </PageShell>
  )
}
