import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTimeMinute, VIETNAM_TIME_ZONE } from '../../../utils/vietnamDateTime.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { isWarehouseRole } from '../../auth/utils/permissions.js'
import { broadcastNotification } from '../../products/services/notificationsApi.js'
import {
  createWarehouseDailyReportSubmission,
  fetchWarehouseDailyReport,
  fetchWarehouseDailyReportSubmissions,
} from '../services/warehouseDailyReportApi.js'
import { exportWarehouseDailyReportExcel } from '../utils/warehouseDailyReportExcel.js'

const OPEN_PAGE_SIZE_OPTIONS = [5, 10, 20]
const OPEN_PAGE_SIZE_DEFAULT = 5

const OPEN_KIND_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'Nhập NCC', label: 'Nhập NCC' },
  { key: 'Sản xuất', label: 'Sản xuất' },
  { key: 'YC bổ sung kệ', label: 'YC kệ' },
  { key: 'Gợi ý kệ', label: 'Gợi ý kệ' },
  { key: 'Trừ kho', label: 'Trừ kho' },
]

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

function formatDateVi(ymd) {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')} đ`
}

function statusVi(status) {
  const map = {
    Completed: 'Đã xong',
    Draft: 'Nháp',
    PendingApproval: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Rejected: 'Từ chối',
    Cancelled: 'Đã hủy',
    Pending: 'Chờ xử lý',
    Processing: 'Đang làm',
    PartiallyFulfilled: 'Một phần',
    Waiting: 'Chờ trừ kho',
    Insufficient: 'Thiếu hàng',
    Confirmed: 'Đã xác nhận',
    Open: 'Chưa xử lý',
  }
  return map[status] || status || '—'
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed' || s === 'confirmed' || s === 'approved') return 'bg-[#e8f1eb] text-[#356647]'
  if (s === 'rejected' || s === 'cancelled' || s === 'insufficient') return 'bg-rose-50 text-rose-700'
  if (['draft', 'pending', 'waiting', 'pendingapproval', 'processing', 'open'].includes(s)) {
    return 'bg-amber-100 text-amber-800'
  }
  return 'bg-slate-100 text-slate-600'
}

function ledgerTypeVi(type) {
  const map = {
    SUPPLIER_RECEIPT: 'Nhập NCC',
    STOCK_TRANSFER_WAREHOUSE_OUT: 'Xuất kho → kệ',
    STOCK_TRANSFER_SHELF_IN: 'Nhập kệ',
    SHELF_REPLENISHMENT_OUT: 'Xuất kho → kệ',
    SHELF_REPLENISHMENT_IN: 'Nhập kệ',
    PRODUCTION_MATERIAL_EXPORT: 'Xuất NL sản xuất',
    PRODUCTION_FINISHED_RECEIPT: 'Nhập thành phẩm',
    STOCKTAKE_ADJUSTMENT: 'Điều chỉnh kiểm kê',
    SALES_DEDUCT_LATER: 'Trừ kho theo đơn',
    CUSTOM_BUNDLE_MATERIAL_EXPORT: 'Xuất đóng gói',
    CUSTOMER_RETURN_RECEIPT: 'Nhận hàng trả',
    SUPPLIER_RETURN: 'Trả NCC',
  }
  return map[type] || type || 'Khác'
}

const CATEGORIES = [
  { key: 'receipt', label: 'Nhập NCC' },
  { key: 'production', label: 'Sản xuất' },
  { key: 'transfer', label: 'Chuyển kệ' },
  { key: 'request', label: 'Duyệt YC kệ' },
  { key: 'deduct', label: 'Trừ kho' },
  { key: 'stocktake', label: 'Kiểm kê' },
  { key: 'ledger', label: 'Biến động' },
]

export default function WarehouseDailyReportPage() {
  const today = vietnamTodayInput()
  const yesterday = shiftDateInput(today, -1)
  const [searchParams] = useSearchParams()
  const dateFromQuery = searchParams.get('date')
  const initialDate = dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery) && dateFromQuery <= today
    ? dateFromQuery
    : today

  const [date, setDate] = useState(initialDate)
  const [category, setCategory] = useState('receipt')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentSubmissionId, setSentSubmissionId] = useState(null)
  const [checkingSent, setCheckingSent] = useState(false)
  const [openPage, setOpenPage] = useState(1)
  const [openPageSize, setOpenPageSize] = useState(OPEN_PAGE_SIZE_DEFAULT)
  const [openKind, setOpenKind] = useState('')
  const [openSearch, setOpenSearch] = useState('')

  const session = loadAuthSession()
  const canSendReport = isWarehouseRole(session)
  const isToday = date === today

  useEffect(() => {
    if (!dateFromQuery || !/^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) return
    if (dateFromQuery > today) return
    setDate(dateFromQuery)
  }, [dateFromQuery, today])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await fetchWarehouseDailyReport(date || undefined))
    } catch (error) {
      setReport(null)
      showError(error.message || 'Không tải được báo cáo cuối ngày.')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    async function checkAlreadySent() {
      if (!date) {
        setSentSubmissionId(null)
        return
      }
      setCheckingSent(true)
      try {
        const result = await fetchWarehouseDailyReportSubmissions({ date, page: 1, pageSize: 1 })
        if (!cancelled) {
          setSentSubmissionId(result.items[0]?.id || null)
        }
      } catch {
        if (!cancelled) setSentSubmissionId(null)
      } finally {
        if (!cancelled) setCheckingSent(false)
      }
    }
    checkAlreadySent()
    return () => { cancelled = true }
  }, [date])

  useEffect(() => {
    setOpenPage(1)
    setOpenKind('')
    setOpenSearch('')
  }, [date])

  useEffect(() => {
    setOpenPage(1)
  }, [openPageSize, openKind, openSearch])

  const counts = useMemo(() => {
    if (!report) return {}
    return {
      receipt: report.supplierReceipts.length,
      production: report.productionOrders.length,
      transfer: report.stockTransfers.length,
      request: report.stockAdjustmentReviews.length,
      deduct: report.stockDeductConfirmations.length,
      stocktake: report.warehouseStocktakes.length,
      ledger: report.ledgerByType.length,
    }
  }, [report])

  useEffect(() => {
    if (!report) return
    const next = CATEGORIES.find((c) => (counts[c.key] ?? 0) > 0)
    if (next && (counts[category] ?? 0) === 0) setCategory(next.key)
  }, [report, counts, category])

  const doneTotal = useMemo(() => {
    if (!report) return 0
    const s = report.summary
    return (
      s.supplierReceiptsCompleted
      + s.productionOrdersCompleted
      + s.stockTransfersCompleted
      + s.stockAdjustmentReviews
      + s.stockDeductQueuesConfirmed
      + s.warehouseStocktakesCompleted
    )
  }, [report])

  const openRows = useMemo(() => {
    if (!report?.openCarry) return []
    const oc = report.openCarry
    const rows = []
    for (const i of oc.pendingSupplierReceipts) {
      rows.push({ id: i.id, code: i.code, kind: 'Nhập NCC', status: i.status, to: `/inventory/supplier-receipts/${i.id}` })
    }
    for (const i of oc.pendingProductionOrders) {
      rows.push({ id: i.id, code: i.code, kind: 'Sản xuất', status: i.status, to: '/inventory/production-orders' })
    }
    for (const i of oc.openStockAdjustmentRequests) {
      rows.push({ id: i.id, code: i.code, kind: 'YC bổ sung kệ', status: i.status, to: '/inventory/stock-requests' })
    }
    for (const i of oc.openSuggestions) {
      rows.push({ id: i.id, code: i.code, kind: 'Gợi ý kệ', status: i.status, to: '/inventory/shelf-replenishment-suggestions' })
    }
    for (const i of oc.waitingDeductQueues) {
      rows.push({ id: i.id, code: i.code, kind: 'Trừ kho', status: i.status, to: '/orders/stock-deduct' })
    }
    return rows
  }, [report])

  const filteredOpenRows = useMemo(() => {
    const keyword = openSearch.trim().toLowerCase()
    return openRows.filter((row) => {
      if (openKind && row.kind !== openKind) return false
      if (!keyword) return true
      return String(row.code || '').toLowerCase().includes(keyword)
        || String(row.kind || '').toLowerCase().includes(keyword)
        || statusVi(row.status).toLowerCase().includes(keyword)
    })
  }, [openRows, openKind, openSearch])

  const pagedOpenRows = useMemo(() => {
    const start = (openPage - 1) * openPageSize
    return filteredOpenRows.slice(start, start + openPageSize)
  }, [filteredOpenRows, openPage, openPageSize])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredOpenRows.length / openPageSize))
    if (openPage > totalPages) setOpenPage(totalPages)
  }, [filteredOpenRows.length, openPage, openPageSize])

  const detailRows = useMemo(() => {
    if (!report) return []
    switch (category) {
      case 'receipt':
        return report.supplierReceipts.map((r) => ({
          id: r.id,
          code: r.code,
          col2: r.actorName || '—',
          col3: formatMoney(r.totalAmount),
          col4: formatVietnamDateTimeMinute(r.completedAtUtc),
          to: `/inventory/supplier-receipts/${r.id}`,
        }))
      case 'production':
        return report.productionOrders.map((r) => ({
          id: r.id,
          code: r.code,
          col2: r.actorName || '—',
          col3: `NL ${r.materialLineCount} / TP ${r.outputLineCount}`,
          col4: formatVietnamDateTimeMinute(r.completedAtUtc),
          to: '/inventory/production-orders',
        }))
      case 'transfer':
        return report.stockTransfers.map((r) => ({
          id: r.id,
          code: r.code,
          col2: r.sourceRequestCode || r.actorName || '—',
          col3: `${r.totalQuantity} sp`,
          col4: formatVietnamDateTimeMinute(r.completedAtUtc),
          to: '/inventory/stock-transfers',
        }))
      case 'request':
        return report.stockAdjustmentReviews.map((r) => ({
          id: r.id,
          code: r.code,
          col2: r.reviewedByName || '—',
          col3: statusVi(r.status),
          col3Status: r.status,
          col4: formatVietnamDateTimeMinute(r.reviewedAtUtc),
          to: '/inventory/stock-requests',
        }))
      case 'deduct':
        return report.stockDeductConfirmations.map((r) => ({
          id: r.queueId,
          code: r.orderCode,
          col2: r.confirmedByName || '—',
          col3: 'Đã xác nhận',
          col4: formatVietnamDateTimeMinute(r.confirmedAtUtc),
          to: '/orders/stock-deduct',
        }))
      case 'stocktake':
        return report.warehouseStocktakes.map((r) => ({
          id: r.id,
          code: r.code,
          col2: r.reviewedByName || '—',
          col3: `${r.itemCount} dòng`,
          col4: formatVietnamDateTimeMinute(r.reviewedAtUtc),
          to: '/inventory/stocktake',
        }))
      case 'ledger':
        return report.ledgerByType.map((r) => ({
          id: r.transactionType,
          code: ledgerTypeVi(r.transactionType),
          col2: `${r.entryCount} lần`,
          col3: r.netQuantityDelta > 0 ? `+${r.netQuantityDelta}` : String(r.netQuantityDelta),
          col3Tone: r.netQuantityDelta > 0 ? 'text-emerald-700' : r.netQuantityDelta < 0 ? 'text-rose-700' : 'text-slate-700',
          col4: '—',
          to: null,
        }))
      default:
        return []
    }
  }, [report, category])

  const detailHeaders = {
    receipt: ['Mã phiếu', 'Người xử lý', 'Giá trị', 'Hoàn tất'],
    production: ['Mã SX', 'Người lập', 'NL / TP', 'Hoàn tất'],
    transfer: ['Mã phiếu', 'YC / Người', 'Số lượng', 'Hoàn tất'],
    request: ['Mã YC', 'Người xử lý', 'Trạng thái', 'Thời điểm'],
    deduct: ['Mã đơn', 'Người xác nhận', 'Kết quả', 'Thời điểm'],
    stocktake: ['Mã KK', 'Người duyệt', 'Số dòng', 'Duyệt lúc'],
    ledger: ['Loại', 'Số lần', 'Δ SL', ''],
  }[category]

  const openCount = report?.summary?.openCarryCount ?? 0
  const dateLabel = date === today ? 'Hôm nay' : date === yesterday ? 'Hôm qua' : formatDateVi(date)
  const snap = report?.endingSnapshot

  const handleExport = useCallback(() => {
    if (!report) {
      showError('Chưa có dữ liệu để xuất.')
      return
    }
    try {
      exportWarehouseDailyReportExcel({
        report,
        date,
        dateLabel,
        doneTotal,
        openRows,
      })
      showSuccess('Đã xuất file Excel.')
    } catch (error) {
      showError(error.message || 'Không xuất được file Excel.')
    }
  }, [report, date, dateLabel, doneTotal, openRows])

  const handleSend = useCallback(async () => {
    if (!report) {
      showError('Chưa có dữ liệu để gửi.')
      return
    }
    if (sentSubmissionId) {
      showError(`Báo cáo ngày ${dateLabel} đã được gửi. Mỗi ngày chỉ gửi một lần.`)
      return
    }

    const senderName = session?.fullName || session?.username || 'Thủ kho'
    const confirmed = await confirmDialog({
      title: 'Gửi báo cáo cho Quản lý / Admin?',
      message: `Lưu snapshot báo cáo ngày ${dateLabel} (${date}) rồi gửi thông báo tới Quản lý và Admin. Mỗi ngày chỉ gửi được một lần.`,
      confirmLabel: 'Gửi báo cáo',
      cancelLabel: 'Hủy',
      tone: 'primary',
    })
    if (!confirmed) return

    setSending(true)
    try {
      const submission = await createWarehouseDailyReportSubmission(date)
      const snapData = submission.report?.endingSnapshot ?? report.endingSnapshot
      const done = submission.doneTotal ?? doneTotal
      await broadcastNotification({
        type: 'warehouse_daily_report_shared',
        title: `Báo cáo cuối ngày kho · ${dateLabel}`,
        body: [
          `${senderName} đã gửi báo cáo cuối ngày kho ngày ${formatDateVi(date)}.`,
          `Đã làm: ${done} việc.`,
          `Tồn kho: ${Number(snapData.totalWarehouseQuantity || 0).toLocaleString('vi-VN')}.`,
          `Sắp hết: ${snapData.lowStockSkuCount ?? submission.lowStockSkuCount}.`,
          `Lô sắp HSD: ${snapData.expiringBatchCount30Days ?? submission.expiringBatchCount30Days}.`,
          `Còn dở lúc gửi: ${submission.openCarryCount}.`,
        ].join(' '),
        link: `/inventory/warehouse-daily-report/submissions/${submission.id}`,
        recipientRoleNames: ['Manager', 'Admin'],
        referenceType: 'WarehouseDailyReportSubmission',
        referenceId: submission.id,
      })
      setSentSubmissionId(submission.id)
      showSuccess('Đã gửi báo cáo tới Quản lý và Admin.')
    } catch (error) {
      showError(error.message || 'Không gửi được báo cáo.')
      try {
        const result = await fetchWarehouseDailyReportSubmissions({ date, page: 1, pageSize: 1 })
        if (result.items[0]?.id) setSentSubmissionId(result.items[0].id)
      } catch {
        // ignore refresh failure
      }
    } finally {
      setSending(false)
    }
  }, [report, session, dateLabel, date, doneTotal, sentSubmissionId])

  return (
    <PageShell>
      <PageHeader
        title="Báo cáo cuối ngày"
        titleInfo="Tóm tắt việc kho đã hoàn tất theo ngày. Phần còn dở là tồn đọng hiện tại, không gắn ngày chọn."
        rightContent={(
          <div className="flex flex-wrap items-center gap-2">
            {canSendReport && sentSubmissionId ? (
              <Link
                to={`/inventory/warehouse-daily-report/submissions/${sentSubmissionId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Đã gửi ngày này
              </Link>
            ) : null}
            {canSendReport && !sentSubmissionId ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={!report || loading || sending || checkingSent}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#538463] bg-white px-4 py-2.5 text-sm font-bold text-[#356647] hover:bg-[#e8f1eb] disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {sending ? 'Đang gửi…' : 'Gửi báo cáo'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleExport}
              disabled={!report || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              {loading ? 'Đang tải…' : 'Tải lại'}
            </button>
          </div>
        )}
      />

      {/* Bộ lọc ngày */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDate(today)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              date === today
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => setDate(yesterday)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              date === yesterday
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hôm qua
          </button>
        </div>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <p className="text-sm text-slate-600 md:ml-1">
          Đang xem <span className="font-semibold text-slate-800">{dateLabel}</span>
          {report ? (
            <span className="text-slate-500"> · {doneTotal} việc đã làm</span>
          ) : null}
        </p>
      </div>

      {loading && !report ? <p className="mb-4 text-sm text-slate-500">Đang tải báo cáo…</p> : null}
      {!loading && !report ? (
        <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Không tải được báo cáo. Bấm “Tải lại” để thử lại.
        </p>
      ) : null}

      {report ? (
        <>
          {/* Snapshot */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tồn kho</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {snap.totalWarehouseQuantity.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sắp hết</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${snap.lowStockSkuCount ? 'text-amber-700' : 'text-slate-900'}`}>
                {snap.lowStockSkuCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lô sắp HSD (30 ngày)</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${snap.expiringBatchCount30Days ? 'text-amber-700' : 'text-slate-900'}`}>
                {snap.expiringBatchCount30Days}
              </p>
            </div>
          </div>

          {/* Còn dở */}
          {openCount > 0 ? (
            isToday ? (
              <section className="mb-4 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
                <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
                  <p className="text-sm font-bold text-amber-900">
                    Còn dở hiện tại · {openCount}
                    {filteredOpenRows.length !== openCount ? (
                      <span className="font-semibold text-amber-800/80"> · đang hiện {filteredOpenRows.length}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    Phiếu chưa xong đến lúc này. Bấm mã để mở và xử lý.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex flex-wrap gap-1.5">
                      {OPEN_KIND_FILTERS.map((f) => {
                        const active = openKind === f.key
                        return (
                          <button
                            key={f.key || 'all'}
                            type="button"
                            onClick={() => setOpenKind(f.key)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              active
                                ? 'bg-amber-800 text-white'
                                : 'bg-white text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {f.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                      <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-amber-800/50">
                        search
                      </span>
                      <input
                        type="search"
                        value={openSearch}
                        onChange={(e) => setOpenSearch(e.target.value)}
                        placeholder="Tìm mã phiếu / đơn…"
                        className="w-full rounded-lg border border-amber-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Loại</th>
                        <th className="px-4 py-3">Mã</th>
                        <th className="px-4 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedOpenRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-slate-500">
                            Không có phiếu khớp bộ lọc / tìm kiếm.
                          </td>
                        </tr>
                      ) : (
                        pagedOpenRows.map((row) => (
                          <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                            <td className="px-5 py-3 text-slate-600">{row.kind}</td>
                            <td className="px-4 py-3">
                              <Link to={row.to} className="font-mono text-xs font-bold text-[#356647] hover:underline">
                                {row.code}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                                {statusVi(row.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredOpenRows.length > openPageSize || openPage > 1 ? (
                  <TablePagination
                    page={openPage}
                    pageSize={openPageSize}
                    totalCount={filteredOpenRows.length}
                    itemLabel="phiếu"
                    pageSizeOptions={OPEN_PAGE_SIZE_OPTIONS}
                    onPageChange={setOpenPage}
                    onPageSizeChange={(size) => {
                      setOpenPageSize(size)
                      setOpenPage(1)
                    }}
                  />
                ) : null}
              </section>
            ) : (
              <div className="mb-4 rounded-2xl border border-slate-100 bg-white px-5 py-3.5 text-sm text-slate-600 shadow-sm">
                Hiện còn <strong className="text-slate-800">{openCount}</strong> việc chưa xong (không thuộc ngày {dateLabel}).
                {' '}
                <button
                  type="button"
                  onClick={() => setDate(today)}
                  className="font-semibold text-[#356647] hover:underline"
                >
                  Xem hôm nay
                </button>
              </div>
            )
          ) : null}

          {/* Việc đã làm */}
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
              {CATEGORIES.map((c) => {
                const n = counts[c.key] ?? 0
                const active = category === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                        : n === 0
                          ? 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                    <span className={`ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    {detailHeaders.map((h, idx) => (
                      <th key={`${h || 'empty'}-${idx}`} className="px-5 py-3 first:pl-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-slate-500">Đang tải…</td>
                    </tr>
                  ) : detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-slate-500">
                        Không có dữ liệu trong ngày này.
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                        <td className="px-5 py-3.5">
                          {row.to ? (
                            <Link to={row.to} className="font-mono text-xs font-bold text-[#356647] hover:underline">
                              {row.code}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-800">{row.code}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{row.col2}</td>
                        <td className={`px-4 py-3.5 ${row.col3Tone || 'text-slate-700'}`}>
                          {row.col3Status ? (
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusClass(row.col3Status)}`}>
                              {row.col3}
                            </span>
                          ) : (
                            row.col3
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{row.col4}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-3 text-xs text-slate-400">
            Cập nhật {formatVietnamDateTimeMinute(report.generatedAtUtc)}
          </p>
        </>
      ) : null}
    </PageShell>
  )
}
