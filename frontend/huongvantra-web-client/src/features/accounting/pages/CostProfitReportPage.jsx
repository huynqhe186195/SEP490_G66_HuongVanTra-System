import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  formatVnd,
  formatVndInput,
  parseVndInput,
  sanitizeVndInput,
} from '../../../utils/vietnamCurrency.js'
import { canEditAccountingSalePrice } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  fetchAccountingCostProfitSkus,
  fetchSkuPriceHistory,
  updateAccountingRetailPrice,
} from '../../products/services/productSkusApi.js'

const SORT_OPTIONS = [
  ['skuCode', 'SKU'],
  ['name', 'Tên sản phẩm'],
  ['retailPrice', 'Giá bán hiện tại'],
  ['averageCostPrice', 'Giá vốn trung bình'],
  ['lastPurchaseUnitCost', 'Đơn giá nhập gần nhất'],
  ['profit', 'Lợi nhuận dự kiến'],
  ['costUpdatedAt', 'Ngày cập nhật giá vốn'],
]

function downloadCsv(filename, rows) {
  const escape = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function toRow(sku) {
  const retailPrice = Number(sku.retailPrice || 0)
  const averageCostPrice = Number(sku.averageCostPrice || 0)
  return {
    ...sku,
    name: [sku.productName, sku.variantName].filter(Boolean).join(' - ') || sku.skuCode,
    profit: retailPrice - averageCostPrice,
  }
}

function compareNullable(left, right) {
  if (left == null && right == null) return 0
  if (left == null) return -1
  if (right == null) return 1
  if (typeof left === 'string' || typeof right === 'string') {
    return String(left).localeCompare(String(right), 'vi', { numeric: true, sensitivity: 'base' })
  }
  return Number(left) - Number(right)
}

function historyTypeLabel(type) {
  return type === 'RetailPrice' ? 'Giá bán' : 'Giá vốn trung bình'
}

function historyStatusLabel(item) {
  if (item.type === 'RetailPrice') return null
  if (item.wasApplied === true) return 'Đã áp dụng'
  if (String(item.processingResult).toLowerCase() === 'superseded') {
    return 'Không áp dụng — Sự kiện cũ hơn'
  }
  if (String(item.processingResult).toLowerCase() === 'waiting_sequence') {
    return 'Đang chờ đủ thứ tự dòng'
  }
  return item.processingResult || 'Không áp dụng'
}

export default function CostProfitReportPage() {
  const session = loadAuthSession()
  const canEditSalePrice = canEditAccountingSalePrice(session)
  const [isLoading, setIsLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [draftPrices, setDraftPrices] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [costFilter, setCostFilter] = useState('all')
  const [receiptFilter, setReceiptFilter] = useState('all')
  const [profitFilter, setProfitFilter] = useState('all')
  const [sortField, setSortField] = useState('skuCode')
  const [sortDirection, setSortDirection] = useState('asc')
  const [historyState, setHistoryState] = useState(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const mapped = (await fetchAccountingCostProfitSkus()).map(toRow)
      setRows(mapped)
      setDraftPrices(Object.fromEntries(mapped.map((row) => [row.skuId, String(row.retailPrice)])))
    } catch (error) {
      showError(error.message)
      setRows([])
      setDraftPrices({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const selected = rows.filter((row) => {
      const matchesSearch = !term
        || row.skuCode.toLowerCase().includes(term)
        || row.name.toLowerCase().includes(term)
        || String(row.sourceReceiptCode || '').toLowerCase().includes(term)
      const matchesCost = costFilter === 'all'
        || (costFilter === 'with' ? row.averageCostPrice > 0 : row.averageCostPrice <= 0)
      const matchesReceipt = receiptFilter === 'all'
        || (receiptFilter === 'with' ? Boolean(row.sourceReceiptId) : !row.sourceReceiptId)
      const matchesProfit = profitFilter === 'all'
        || (profitFilter === 'profit' ? row.profit > 0 : row.profit < 0)
      return matchesSearch && matchesCost && matchesReceipt && matchesProfit
    })

    return [...selected].sort((left, right) => {
      const result = compareNullable(left[sortField], right[sortField])
      return sortDirection === 'asc' ? result : -result
    })
  }, [costFilter, profitFilter, receiptFilter, rows, search, sortDirection, sortField])

  const pageItems = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE
    return filtered.slice(start, start + TABLE_PAGE_SIZE)
  }, [filtered, page])

  function resetPageAnd(setter, value) {
    setter(value)
    setPage(1)
  }

  async function saveRetailPrice(row) {
    const retailPrice = parseVndInput(draftPrices[row.skuId])
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      showError('Giá bán mới phải lớn hơn 0.')
      return
    }

    setSavingId(row.skuId)
    try {
      const updated = toRow(await updateAccountingRetailPrice(row.skuId, retailPrice))
      setRows((current) => current.map((item) => (item.skuId === row.skuId ? updated : item)))
      setDraftPrices((current) => ({ ...current, [row.skuId]: String(updated.retailPrice) }))
      showSuccess(`Đã cập nhật Giá bán cho SKU ${row.skuCode}.`)
    } catch (error) {
      showError(error.message)
    } finally {
      setSavingId(null)
    }
  }

  async function openHistory(row) {
    setHistoryState({ row, items: [], isLoading: true, error: '' })
    try {
      const result = await fetchSkuPriceHistory(row.skuId, { page: 1, pageSize: 100 })
      setHistoryState({ row, items: result.items, isLoading: false, error: '' })
    } catch (error) {
      setHistoryState({ row, items: [], isLoading: false, error: error.message })
    }
  }

  function handleExport() {
    downloadCsv(`bang-gia-von-trung-binh-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['SKU', 'Tên sản phẩm', 'Đơn vị', 'Giá bán', 'Giá vốn trung bình', 'Đơn giá nhập gần nhất', 'Phiếu nhập nguồn', 'Ngày cập nhật giá vốn', 'Lợi nhuận dự kiến'],
      ...filtered.map((row) => [
        row.skuCode,
        row.name,
        row.unitName,
        row.retailPrice,
        row.averageCostPrice,
        row.lastPurchaseUnitCost ?? '',
        row.sourceReceiptCode,
        row.costUpdatedAt ?? '',
        row.profit,
      ]),
    ])
    showSuccess('Đã xuất CSV.')
  }

  return (
    <PageShell>
      <PageHeader
        title="Bảng giá vốn trung bình & giá bán"
        titleInfo="Giá vốn trung bình do ProductService cập nhật từ Phiếu nhập NCC đã duyệt. Chỉ Admin được điều chỉnh Giá bán."
        rightContent={(
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất CSV
          </button>
        )}
      />

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input
          value={search}
          onChange={(event) => resetPageAnd(setSearch, event.target.value)}
          placeholder="Tìm SKU, tên hàng hoặc phiếu nhập..."
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm xl:col-span-2"
        />
        <select
          value={costFilter}
          onChange={(event) => resetPageAnd(setCostFilter, event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tất cả giá vốn</option>
          <option value="with">Có giá vốn</option>
          <option value="without">Chưa có giá vốn</option>
        </select>
        <select
          value={receiptFilter}
          onChange={(event) => resetPageAnd(setReceiptFilter, event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tất cả Phiếu nhập</option>
          <option value="with">Có Phiếu nhập nguồn</option>
          <option value="without">Chưa có Phiếu nhập nguồn</option>
        </select>
        <select
          value={profitFilter}
          onChange={(event) => resetPageAnd(setProfitFilter, event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tất cả lợi nhuận</option>
          <option value="profit">Có lợi nhuận</option>
          <option value="loss">Đang lỗ</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Làm mới
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sắp xếp</span>
        <select
          value={sortField}
          onChange={(event) => resetPageAnd(setSortField, event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => resetPageAnd(setSortDirection, sortDirection === 'asc' ? 'desc' : 'asc')}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          <span className="material-symbols-outlined text-[18px]">
            {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
          {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1380px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Tên sản phẩm</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3 text-right">Giá bán hiện tại</th>
                <th className="px-4 py-3 text-right">Giá bán mới</th>
                <th className="px-4 py-3 text-right">Giá vốn trung bình</th>
                <th className="px-4 py-3 text-right">Đơn giá nhập gần nhất</th>
                <th className="px-4 py-3">Phiếu nhập nguồn</th>
                <th className="px-4 py-3">Cập nhật giá vốn</th>
                <th className="px-4 py-3 text-right">Lợi nhuận dự kiến</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Không có dữ liệu</td></tr>
              ) : pageItems.map((row) => (
                <tr key={row.skuId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{row.skuCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.unitName || '—'}</td>
                  <td className="px-4 py-3 text-right">{formatVnd(row.retailPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEditSalePrice ? (
                      <div className="relative ml-auto w-36">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatVndInput(draftPrices[row.skuId] ?? '')}
                          onChange={(event) => setDraftPrices((current) => ({
                            ...current,
                            [row.skuId]: sanitizeVndInput(event.target.value),
                          }))}
                          className="w-full rounded-lg border border-slate-200 py-1.5 pl-2 pr-7 text-right"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Read-only</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatVnd(row.averageCostPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatVnd(row.lastPurchaseUnitCost)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#356647]">
                    {row.sourceReceiptId ? (
                      <Link
                        to={`/inventory/supplier-receipts/${row.sourceReceiptId}`}
                        className="font-semibold underline decoration-[#538463]/40 underline-offset-2 hover:text-[#274b34]"
                      >
                        {row.sourceReceiptCode || 'Xem Phiếu nhập'}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.costUpdatedAt ? formatVietnamDateTime(row.costUpdatedAt) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.profit >= 0 ? 'text-[#356647]' : 'text-rose-600'}`}>
                    {formatVnd(row.profit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openHistory(row)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Lịch sử giá
                      </button>
                      {canEditSalePrice ? (
                        <button
                          type="button"
                          disabled={savingId === row.skuId || parseVndInput(draftPrices[row.skuId]) === row.retailPrice}
                          onClick={() => saveRetailPrice(row)}
                          className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingId === row.skuId ? 'Đang lưu...' : 'Lưu Giá bán'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={TABLE_PAGE_SIZE}
          totalCount={filtered.length}
          onPageChange={setPage}
          itemLabel="SKU"
        />
      </div>

      {historyState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setHistoryState(null)}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Lịch sử giá — {historyState.row.skuCode}</h2>
                <p className="text-sm text-slate-500">{historyState.row.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryState(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {historyState.isLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">Đang tải lịch sử...</p>
            ) : historyState.error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{historyState.error}</p>
            ) : historyState.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Chưa có lịch sử thay đổi giá.</p>
            ) : (
              <div className="space-y-3">
                {historyState.items.map((item) => {
                  const status = historyStatusLabel(item)
                  return (
                    <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.type === 'RetailPrice'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                          >
                            {historyTypeLabel(item.type)}
                          </span>
                          <p className="mt-2 text-sm text-slate-700">
                            <strong>{formatVnd(item.oldValue)}</strong>
                            <span className="mx-2 text-slate-400">→</span>
                            <strong className="text-[#356647]">{formatVnd(item.newValue)}</strong>
                          </p>
                          {item.incomingUnitCost != null ? (
                            <p className="mt-1 text-xs text-slate-500">Đơn giá nhập: {formatVnd(item.incomingUnitCost)}</p>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {item.type === 'AverageCost' ? (
                            <>
                              <p>Duyệt nguồn: {item.sourceApprovedAt ? formatVietnamDateTime(item.sourceApprovedAt) : '—'}</p>
                              <p className="mt-1">Cập nhật: {item.updatedAt ? formatVietnamDateTime(item.updatedAt) : '—'}</p>
                            </>
                          ) : (
                            <p>{item.changedAt ? formatVietnamDateTime(item.changedAt) : '—'}</p>
                          )}
                          <p className="mt-1">{item.changedBy || '—'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{item.sourceType || '—'}</span>
                        {status ? (
                          <span className={`rounded-md px-2 py-1 ${
                            item.wasApplied === true ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                          >
                            {status}
                          </span>
                        ) : null}
                        {item.sourceReceiptId ? (
                          <Link
                            to={`/inventory/supplier-receipts/${item.sourceReceiptId}`}
                            className="font-semibold text-[#356647] underline underline-offset-2"
                          >
                            {item.sourceReceiptCode || 'Phiếu nhập nguồn'}
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
