import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import { fetchWarehouseDailyReportSubmissions } from '../services/warehouseDailyReportApi.js'

function formatDateVi(ymd) {
  if (!ymd) return '—'
  const raw = String(ymd).slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return raw
  return `${d}/${m}/${y}`
}

export default function WarehouseDailyReportSubmissionsPage() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchWarehouseDailyReportSubmissions({
        date: dateFilter || undefined,
        page,
        pageSize,
      })
      setItems(result.items)
      setTotalItems(result.totalItems)
    } catch (error) {
      setItems([])
      setTotalItems(0)
      showError(error.message || 'Không tải được danh sách báo cáo đã gửi.')
    } finally {
      setLoading(false)
    }
  }, [dateFilter, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageShell>
      <PageHeader
        title="Báo cáo đã gửi"
        titleInfo="Lịch sử các lần Thủ kho gửi báo cáo cuối ngày cho Quản lý / Admin. Mỗi lần là một snapshot đầy đủ tại thời điểm gửi."
        rightContent={(
          <Link
            to="/inventory/warehouse-daily-report"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Báo cáo live
          </Link>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="font-semibold">Lọc ngày báo cáo</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {dateFilter ? (
          <button
            type="button"
            onClick={() => {
              setDateFilter('')
              setPage(1)
            }}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Xóa lọc
          </button>
        ) : null}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Ngày báo cáo</th>
                <th className="px-4 py-3">Gửi lúc</th>
                <th className="px-4 py-3">Người gửi</th>
                <th className="px-4 py-3 text-right">Đã làm</th>
                <th className="px-4 py-3 text-right">Còn dở</th>
                <th className="px-4 py-3 text-right">Tồn kho</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-slate-500">Đang tải…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-slate-500">Chưa có lần gửi nào.</td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{formatDateVi(row.businessDate)}</td>
                    <td className="px-4 py-3.5 text-slate-700">{formatVietnamDateTimeMinute(row.sentAtUtc)}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {row.sentByName}
                      {row.sentByRoleName ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{row.sentByRoleName}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-800">{row.doneTotal}</td>
                    <td className={`px-4 py-3.5 text-right tabular-nums font-semibold ${row.openCarryCount ? 'text-amber-700' : 'text-slate-800'}`}>
                      {row.openCarryCount}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-800">
                      {row.totalWarehouseQuantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/inventory/warehouse-daily-report/submissions/${row.id}`}
                        className="font-semibold text-[#356647] hover:underline"
                      >
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalItems}
          itemLabel="lần gửi"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>
    </PageShell>
  )
}
