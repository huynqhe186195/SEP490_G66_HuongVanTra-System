import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'

const OPEN_KIND_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'Nhập NCC', label: 'Nhập NCC' },
  { key: 'Sản xuất', label: 'Sản xuất' },
  { key: 'YC bổ sung kệ', label: 'YC kệ' },
  { key: 'Gợi ý kệ', label: 'Gợi ý kệ' },
  { key: 'Trừ kho', label: 'Trừ kho' },
]

const CATEGORIES = [
  { key: 'receipt', label: 'Nhập NCC' },
  { key: 'production', label: 'Sản xuất' },
  { key: 'transfer', label: 'Chuyển kệ' },
  { key: 'request', label: 'Duyệt YC kệ' },
  { key: 'deduct', label: 'Trừ kho' },
  { key: 'stocktake', label: 'Kiểm kê' },
  { key: 'ledger', label: 'Biến động' },
]

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

function buildOpenRows(report) {
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
}

/**
 * Khối nội dung báo cáo (snapshot + còn dở + tab chi tiết).
 * @param {{ report: object, showOpenAsFrozen?: boolean, dateLabel?: string }} props
 */
export default function WarehouseDailyReportPanels({ report, showOpenAsFrozen = false, dateLabel = '' }) {
  const [category, setCategory] = useState('receipt')
  const [openPage, setOpenPage] = useState(1)
  const [openKind, setOpenKind] = useState('')
  const [openSearch, setOpenSearch] = useState('')

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

  const openRows = useMemo(() => buildOpenRows(report), [report])

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

  const { pageSize: openPageSize, setPageSize: setOpenPageSize, pageSizeOptions: openPageSizeOptions } = useTotalAwarePageSize(filteredOpenRows.length)

  const pagedOpenRows = useMemo(() => {
    const start = (openPage - 1) * openPageSize
    return filteredOpenRows.slice(start, start + openPageSize)
  }, [filteredOpenRows, openPage, openPageSize])

  useEffect(() => {
    setOpenPage(1)
  }, [openKind, openSearch])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((filteredOpenRows.length || 0) / openPageSize) || 1)
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

  if (!report) return null

  const snap = report.endingSnapshot
  const openCount = report.summary?.openCarryCount ?? 0

  return (
    <div>
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

      {openCount > 0 ? (
        <section className="mb-4 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
            <p className="text-sm font-bold text-amber-900">
              {showOpenAsFrozen ? `Còn dở lúc gửi · ${openCount}` : `Còn dở hiện tại · ${openCount}`}
              {filteredOpenRows.length !== openCount ? (
                <span className="font-semibold text-amber-800/80"> · đang hiện {filteredOpenRows.length}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              {showOpenAsFrozen
                ? 'Snapshot tại thời điểm gửi báo cáo.'
                : 'Phiếu chưa xong đến lúc này. Bấm mã để mở và xử lý.'}
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
                    <td colSpan={3} className="px-5 py-8 text-slate-500">Không có phiếu khớp bộ lọc / tìm kiếm.</td>
                  </tr>
                ) : (
                  pagedOpenRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                      <td className="px-5 py-3 text-slate-600">{row.kind}</td>
                      <td className="px-4 py-3">
                        {showOpenAsFrozen ? (
                          <span className="font-mono text-xs font-bold text-slate-800">{row.code}</span>
                        ) : (
                          <Link to={row.to} className="font-mono text-xs font-bold text-[#356647] hover:underline">{row.code}</Link>
                        )}
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
              pageSizeOptions={openPageSizeOptions}
              onPageChange={setOpenPage}
              onPageSizeChange={(size) => {
                setOpenPageSize(size)
                setOpenPage(1)
              }}
            />
          ) : null}
        </section>
      ) : null}

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
                <span className={`ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>{n}</span>
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
              {detailRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-slate-500">
                    Không có dữ liệu{dateLabel ? ` trong ngày ${dateLabel}` : ''}.
                  </td>
                </tr>
              ) : (
                detailRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                    <td className="px-5 py-3.5">
                      {row.to && !showOpenAsFrozen ? (
                        <Link to={row.to} className="font-mono text-xs font-bold text-[#356647] hover:underline">{row.code}</Link>
                      ) : (
                        <span className="font-mono text-xs font-bold text-slate-800">{row.code}</span>
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
        Snapshot lúc {formatVietnamDateTimeMinute(report.generatedAtUtc)}
      </p>
    </div>
  )
}

export function computeDoneTotal(report) {
  if (!report?.summary) return 0
  const s = report.summary
  return (
    s.supplierReceiptsCompleted
    + s.productionOrdersCompleted
    + s.stockTransfersCompleted
    + s.stockAdjustmentReviews
    + s.stockDeductQueuesConfirmed
    + s.warehouseStocktakesCompleted
  )
}

export function buildOpenRowsForExport(report) {
  return buildOpenRows(report)
}
