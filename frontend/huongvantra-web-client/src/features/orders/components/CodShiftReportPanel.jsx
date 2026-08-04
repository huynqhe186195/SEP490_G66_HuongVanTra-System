import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  getOrderStatusClass,
  getOrderStatusLabel,
  isCodOverdue,
} from '../utils/orderDisplay.js'

const SCOPE_OPTIONS = [
  { key: 'shift', label: 'Theo ca đang trực' },
  { key: 'day', label: 'Theo ngày' },
]

function todayInput() {
  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return vn.toISOString().slice(0, 10)
}

function toLocalDayStartIso(value) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function toLocalDayEndIso(value) {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59.999+07:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** workDate yyyy-MM-dd + HH:mm (VN) → ISO UTC. */
function vnWallTimeToIso(workDate, timeHm, { endOfMinute = false } = {}) {
  if (!workDate || !timeHm) return undefined
  const normalized = String(timeHm).trim().length === 5 ? `${timeHm}:00` : String(timeHm).trim()
  const suffix = endOfMinute ? '.999' : ''
  const date = new Date(`${workDate}T${normalized}${suffix}+07:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function resolveShiftWindow(onDuty) {
  if (!onDuty?.workDate || !onDuty?.start || !onDuty?.end) return null
  const fromIso = vnWallTimeToIso(onDuty.workDate, onDuty.start)
  let toIso = vnWallTimeToIso(onDuty.workDate, onDuty.end, { endOfMinute: true })
  if (!fromIso || !toIso) return null

  // Ca qua đêm: end < start → cộng 1 ngày.
  if (new Date(toIso).getTime() <= new Date(fromIso).getTime()) {
    const nextDay = new Date(`${onDuty.workDate}T12:00:00+07:00`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const nextYmd = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    toIso = vnWallTimeToIso(nextYmd, onDuty.end, { endOfMinute: true })
  }

  return { fromIso, toIso }
}

function sumAmount(rows, picker) {
  return rows.reduce((total, row) => total + Number(picker(row) || 0), 0)
}

function isPendingCod(row) {
  return !row.isCodVerified && String(row.orderStatus).toLowerCase() !== 'cancelled'
}

function isCompletedCod(row) {
  return String(row.orderStatus).toLowerCase() === 'completed' || Boolean(row.isCodVerified)
}

function matchesStatusFilter(row, statusFilter) {
  if (!statusFilter) return true
  if (statusFilter === 'pending') return isPendingCod(row)
  if (statusFilter === 'overdue') return isPendingCod(row) && isCodOverdue(row)
  if (statusFilter === 'shipping') {
    return isPendingCod(row) && String(row.orderStatus).toLowerCase() === 'shipping'
  }
  if (statusFilter === 'reserved') return Boolean(row.hasActiveStockReservation)
  if (statusFilter === 'completed') return isCompletedCod(row)
  if (statusFilter === 'cancelled') return String(row.orderStatus).toLowerCase() === 'cancelled'
  return true
}

export default function CodShiftReportPanel({ searchValue = '' }) {
  const session = loadAuthSession()
  const [scope, setScope] = useState('shift')
  const [fromDate, setFromDate] = useState(() => todayInput())
  const [toDate, setToDate] = useState(() => todayInput())
  const [statusFilter, setStatusFilter] = useState('')
  const [onDuty, setOnDuty] = useState(null)
  const [dutyLoaded, setDutyLoaded] = useState(false)
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)

  const refreshDuty = useCallback(async () => {
    try {
      const duty = await fetchOnDutyShift('Shelf')
      setOnDuty(duty)
      return duty
    } catch {
      setOnDuty(null)
      return null
    } finally {
      setDutyLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshDuty()
  }, [refreshDuty])

  const shiftWindow = useMemo(() => resolveShiftWindow(onDuty), [onDuty])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      if (scope === 'shift') {
        const duty = await refreshDuty()
        const window = resolveShiftWindow(duty)
        if (!window) {
          setOrders([])
          return
        }
        const result = await fetchOrders({
          channel: 'COD',
          fromDate: window.fromIso,
          toDate: window.toIso,
          page: 1,
          pageSize: 200,
        })
        setOrders(result.items || [])
        return
      }

      const result = await fetchOrders({
        channel: 'COD',
        fromDate: toLocalDayStartIso(fromDate),
        toDate: toLocalDayEndIso(toDate),
        page: 1,
        pageSize: 200,
      })
      setOrders(result.items || [])
    } catch (error) {
      setOrders([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [scope, fromDate, toDate, refreshDuty])

  useEffect(() => {
    const timer = window.setTimeout(load, 200)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [scope, fromDate, toDate, searchValue, statusFilter, onDuty?.slotId])

  const stats = useMemo(() => {
    const pending = orders.filter(isPendingCod)
    const overdue = pending.filter((row) => isCodOverdue(row))
    const completed = orders.filter(isCompletedCod)
    const cancelled = orders.filter((row) => String(row.orderStatus).toLowerCase() === 'cancelled')
    const shipping = pending.filter((row) => String(row.orderStatus).toLowerCase() === 'shipping')
    const reserved = orders.filter((row) => row.hasActiveStockReservation)

    return {
      createdCount: orders.length,
      createdAmount: sumAmount(orders, (row) => row.finalAmount),
      pendingCount: pending.length,
      pendingAmount: sumAmount(pending, (row) => row.codExpectedAmount || row.finalAmount),
      overdueCount: overdue.length,
      completedCount: completed.length,
      completedAmount: sumAmount(completed, (row) => row.finalAmount),
      cancelledCount: cancelled.length,
      shippingCount: shipping.length,
      reservedCount: reserved.length,
    }
  }, [orders])

  const filtered = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    return orders.filter((row) => {
      const matchesSearch = !term
        || String(row.orderCode || '').toLowerCase().includes(term)
        || String(row.customerSnapshotName || '').toLowerCase().includes(term)
      return matchesSearch && matchesStatusFilter(row, statusFilter)
    })
  }, [orders, searchValue, statusFilter])

  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(filtered.length)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((filtered.length || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [filtered.length, pageSize, page])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const statusChips = useMemo(
    () => [
      { value: '', label: 'Tất cả', count: stats.createdCount },
      { value: 'pending', label: 'Chờ thu', count: stats.pendingCount },
      { value: 'overdue', label: 'Quá hạn', count: stats.overdueCount },
      { value: 'shipping', label: 'Đang giao', count: stats.shippingCount },
      { value: 'reserved', label: 'Giữ chỗ', count: stats.reservedCount },
      { value: 'completed', label: 'Đã thu', count: stats.completedCount },
      { value: 'cancelled', label: 'Đã hủy', count: stats.cancelledCount },
    ],
    [stats],
  )

  const cards = [
    {
      key: '',
      label: 'Tổng tạo',
      value: stats.createdCount,
      note: formatVnd(stats.createdAmount),
    },
    {
      key: 'pending',
      label: 'Chờ thu',
      value: stats.pendingCount,
      note: formatVnd(stats.pendingAmount),
      warn: stats.pendingCount > 0,
    },
    {
      key: 'overdue',
      label: 'Quá hạn',
      value: stats.overdueCount,
      note: 'Chưa thu > 7 ngày',
      warn: stats.overdueCount > 0,
    },
    {
      key: 'completed',
      label: 'Đã thu',
      value: stats.completedCount,
      note: formatVnd(stats.completedAmount),
    },
    {
      key: 'cancelled',
      label: 'Đã hủy',
      value: stats.cancelledCount,
      note: scope === 'shift' ? 'Trong ca hiện tại' : 'Trong khoảng lọc',
    },
  ]

  function resetPageAnd(setter, value) {
    setter(value)
    setPage(1)
  }

  const offDutyInShiftMode = scope === 'shift' && dutyLoaded && !shiftWindow
  const emptyMessage = offDutyInShiftMode
    ? 'Bạn đang ngoài ca. Chuyển sang «Theo ngày» hoặc vào ca đã duyệt để xem báo cáo ca.'
    : 'Không có đơn COD phù hợp bộ lọc.'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              setScope(option.key)
              setPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              scope === option.key
                ? 'bg-[#356647] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        {scope === 'day' ? (
          <>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
              Từ ngày
              <input
                type="date"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                value={fromDate}
                onChange={(event) => resetPageAnd(setFromDate, event.target.value)}
              />
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
              Đến ngày
              <input
                type="date"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                value={toDate}
                onChange={(event) => resetPageAnd(setToDate, event.target.value)}
              />
            </label>
          </>
        ) : (
          <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {offDutyInShiftMode ? (
              <p className="font-semibold text-amber-800">Ngoài ca — chưa có khung giờ để lọc.</p>
            ) : (
              <>
                <p className="font-semibold text-slate-800">{onDuty?.label || '—'}</p>
                <p className="mt-0.5">
                  Ngày ca {onDuty?.workDate || '—'}
                  {onDuty?.start && onDuty?.end ? ` · ${onDuty.start}–${onDuty.end}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Lọc đơn COD tạo trong khung giờ ca (proxy theo giờ; đơn chưa gắn ShiftId).
                </p>
              </>
            )}
          </div>
        )}
        <div className="min-w-0 flex-[1.2] text-xs text-slate-600 sm:pb-2">
          <span className="font-semibold text-slate-800">{session?.fullName || '—'}</span>
          {scope === 'shift' ? (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>{onDuty?.label || 'Ngoài ca'}</span>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const active = statusFilter === card.key
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => resetPageAnd(setStatusFilter, card.key)}
              className={`rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition ${
                active
                  ? 'border-[#356647] ring-1 ring-[#356647]/30'
                  : card.warn
                    ? 'border-rose-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${card.warn ? 'text-rose-700' : 'text-slate-900'}`}>
                {card.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500" title={card.note}>{card.note}</p>
            </button>
          )
        })}
      </div>

      <StatusFilterChips
        options={statusChips}
        value={statusFilter}
        onChange={(value) => resetPageAnd(setStatusFilter, value)}
        ariaLabel="Lọc trạng thái COD"
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-bold text-slate-800">
            Chi tiết đơn
            <span className="ml-2 text-xs font-semibold text-slate-400">({filtered.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mã đơn</th>
                <th className="px-4 py-2.5">Khách</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5 text-right">Thành tiền</th>
                <th className="px-4 py-2.5 text-right">Dự kiến thu</th>
                <th className="px-4 py-2.5">Tạo lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-slate-500">Đang tải...</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-slate-500">{emptyMessage}</td></tr>
              ) : pageItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/orders/${row.id}?from=cod`}
                      className="font-semibold text-[#356647] underline underline-offset-2"
                    >
                      {row.orderCode}
                    </Link>
                    {row.hasActiveStockReservation ? (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        Giữ chỗ
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{row.customerSnapshotName || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getOrderStatusClass(row.orderStatus)}`}>
                      {getOrderStatusLabel(row.orderStatus)}
                    </span>
                    {isCodOverdue(row) ? (
                      <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        Quá hạn
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(row.finalAmount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatVnd(row.codExpectedAmount || row.finalAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {row.createdAt ? formatVietnamDateTime(row.createdAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 ? (
          <TablePagination
            page={page}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalCount={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            itemLabel="đơn"
            disabled={isLoading}
          />
        ) : null}
      </section>
    </div>
  )
}
