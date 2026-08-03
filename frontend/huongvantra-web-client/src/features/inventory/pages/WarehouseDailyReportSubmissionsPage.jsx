import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { formatVietnamDateTimeMinute, VIETNAM_TIME_ZONE } from '../../../utils/vietnamDateTime.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewWarehouseDailyReportLive } from '../../auth/utils/permissions.js'
import { fetchWarehouseDailyReportSubmissions } from '../services/warehouseDailyReportApi.js'

function formatDateVi(ymd) {
  if (!ymd) return '—'
  const raw = String(ymd).slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return raw
  return `${d}/${m}/${y}`
}

function vietnamTodayInput() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftDateInput(baseYmd, deltaDays) {
  const [y, m, d] = baseYmd.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + deltaDays)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utc))
}

function monthStartInput(ymd) {
  return `${ymd.slice(0, 7)}-01`
}

export default function WarehouseDailyReportSubmissionsPage() {
  const today = vietnamTodayInput()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [totalItems, setTotalItems] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalItems)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalItems, pageSize, page])
  const [sentBy, setSentBy] = useState('')
  const [sentByDraft, setSentByDraft] = useState('')
  const canOpenLive = canViewWarehouseDailyReportLive(loadAuthSession())

  const hasFilter = Boolean(fromDate || toDate || sentBy)

  const activePreset = useMemo(() => {
    if (sentBy) return ''
    if (fromDate === today && toDate === today) return 'today'
    if (fromDate === shiftDateInput(today, -6) && toDate === today) return '7d'
    if (fromDate === monthStartInput(today) && toDate === today) return 'month'
    return ''
  }, [fromDate, toDate, sentBy, today])

  const applyRange = useCallback((from, to) => {
    setFromDate(from)
    setToDate(to)
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFromDate('')
    setToDate('')
    setSentBy('')
    setSentByDraft('')
    setPage(1)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchWarehouseDailyReportSubmissions({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sentBy: sentBy || undefined,
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
  }, [fromDate, toDate, sentBy, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageShell>
      <PageHeader
        compact
        title="Báo cáo đã gửi"
        titleInfo="Lịch sử các lần Thủ kho gửi báo cáo cuối ngày cho Quản lý / Admin. Mỗi lần là một snapshot đầy đủ tại thời điểm gửi."
        rightContent={canOpenLive ? (
          <Link
            to="/inventory/warehouse-daily-report"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Báo cáo live
          </Link>
        ) : null}
      />

      <div className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: 'Hôm nay', from: today, to: today },
            { key: '7d', label: '7 ngày', from: shiftDateInput(today, -6), to: today },
            { key: 'month', label: 'Tháng này', from: monthStartInput(today), to: today },
          ].map((preset) => {
            const active = activePreset === preset.key
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyRange(preset.from, preset.to)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[#538463] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-semibold">Từ ngày</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || today}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-semibold">Đến ngày</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={today}
              onChange={(e) => {
                setToDate(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm text-slate-700 sm:max-w-xs">
            <span className="font-semibold">Người gửi</span>
            <input
              type="search"
              value={sentByDraft}
              onChange={(e) => setSentByDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setSentBy(sentByDraft.trim())
                  setPage(1)
                }
              }}
              placeholder="Tên Thủ kho…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSentBy(sentByDraft.trim())
              setPage(1)
            }}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Áp dụng lọc
          </button>
          {hasFilter ? (
            <button
              type="button"
              onClick={clearFilters}
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
                <tr><td colSpan={7} className="px-5 py-8 text-slate-500">Không có báo cáo khớp bộ lọc.</td></tr>
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
          pageSizeOptions={pageSizeOptions}
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
