import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { confirmDialog } from '../../../app/dialog.js'
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

const HISTORY_SOURCE_LABELS = {
  supplier_receipt: 'Phiếu nhập NCC',
  manual_admin_accounting: 'Kế toán cập nhật',
  product_catalog_update: 'Cập nhật catalog SP',
  approved_price_change_request: 'Duyệt yêu cầu đổi giá',
}

function historySourceLabel(sourceType) {
  return HISTORY_SOURCE_LABELS[String(sourceType ?? '').trim().toLowerCase()] ?? null
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

function PriceDraftInput({ value, onChange }) {
  return (
    <div className="relative w-full max-w-[9.5rem]">
      <input
        type="text"
        inputMode="numeric"
        value={formatVndInput(value ?? '')}
        onChange={(event) => onChange(sanitizeVndInput(event.target.value))}
        className="w-full rounded-lg border border-slate-200 py-1.5 pl-2 pr-7 text-right text-sm"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
    </div>
  )
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

  const historyFilteredItems = useMemo(() => {
    if (!historyState?.items?.length) return []
    if (!historyState.typeFilter) return historyState.items
    return historyState.items.filter((item) => item.type === historyState.typeFilter)
  }, [historyState])

  const {
    pageSize: historyPageSize,
    setPageSize: setHistoryPageSize,
    pageSizeOptions: historyPageSizeOptions,
  } = useTotalAwarePageSize(historyFilteredItems.length)

  const historyPage = historyState?.page || 1

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(historyFilteredItems.length / historyPageSize) || 1)
    if (historyPage > totalPages) {
      setHistoryState((current) => (current ? { ...current, page: totalPages } : current))
    }
  }, [historyFilteredItems.length, historyPage, historyPageSize])

  const historyPageItems = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize
    return historyFilteredItems.slice(start, start + historyPageSize)
  }, [historyFilteredItems, historyPage, historyPageSize])

  const historyTypeCounts = useMemo(() => {
    const items = historyState?.items ?? []
    return {
      all: items.length,
      RetailPrice: items.filter((item) => item.type === 'RetailPrice').length,
      AverageCost: items.filter((item) => item.type === 'AverageCost').length,
    }
  }, [historyState?.items])

  const tableColSpan = canEditSalePrice ? 10 : 9

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

  const negativeProfitCount = useMemo(
    () => rows.filter((row) => row.profit < 0).length,
    [rows],
  )

  const filteredNegativeProfitCount = useMemo(
    () => filtered.filter((row) => row.profit < 0).length,
    [filtered],
  )

  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(filtered.length)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((filtered.length || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [filtered.length, pageSize, page])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

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

    const projectedProfit = retailPrice - Number(row.averageCostPrice || 0)
    if (projectedProfit < 0) {
      const confirmed = await confirmDialog({
        title: 'Lợi nhuận dự kiến âm',
        message: `SKU ${row.skuCode}: giá bán ${formatVnd(retailPrice)} thấp hơn giá vốn TB ${formatVnd(row.averageCostPrice)}. Lợi nhuận dự kiến ${formatVnd(projectedProfit)}. Vẫn lưu?`,
        tone: 'danger',
        confirmLabel: 'Vẫn lưu',
      })
      if (!confirmed) return
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
    setHistoryState({
      row,
      items: [],
      isLoading: true,
      error: '',
      typeFilter: '',
      page: 1,
    })
    try {
      const result = await fetchSkuPriceHistory(row.skuId, { page: 1, pageSize: 100 })
      setHistoryState({
        row,
        items: result.items,
        isLoading: false,
        error: '',
        typeFilter: '',
        page: 1,
        totalFromApi: result.totalCount,
      })
    } catch (error) {
      setHistoryState({
        row,
        items: [],
        isLoading: false,
        error: error.message,
        typeFilter: '',
        page: 1,
        totalFromApi: 0,
      })
    }
  }

  function setHistoryTypeFilter(typeFilter) {
    setHistoryState((current) => (current ? { ...current, typeFilter, page: 1 } : current))
  }

  function setHistoryPage(nextPage) {
    setHistoryState((current) => (current ? { ...current, page: nextPage } : current))
  }

  function handleHistoryPageSizeChange(size) {
    setHistoryPageSize(size)
    setHistoryPage(1)
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
        compact
        title="Bảng giá vốn trung bình & giá bán"
        titleInfo="Giá vốn trung bình cập nhật từ Phiếu nhập NCC đã duyệt. Chỉ Kế toán được chỉnh giá bán; Admin/Manager chỉ xem."
        rightContent={(
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] sm:w-auto"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất CSV
          </button>
        )}
      />

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <input
          value={search}
          onChange={(event) => resetPageAnd(setSearch, event.target.value)}
          placeholder="Tìm SKU, tên hàng hoặc phiếu nhập..."
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 xl:col-span-2"
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

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sắp xếp</span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortField}
            onChange={(event) => resetPageAnd(setSortField, event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-none"
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
      </div>

      {!canEditSalePrice ? (
        <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Bạn đang xem ở chế độ chỉ đọc. Chỉ tài khoản <strong>Kế toán</strong> mới chỉnh được giá bán.
        </p>
      ) : null}

      {negativeProfitCount > 0 ? (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-rose-600">warning</span>
            <div>
              <p className="font-semibold">
                {negativeProfitCount} SKU có lợi nhuận dự kiến âm
              </p>
              <p className="mt-0.5 text-xs text-rose-700/90">
                Giá bán đang thấp hơn giá vốn trung bình — nên kiểm tra trước khi bán.
                {profitFilter === 'loss' && filteredNegativeProfitCount !== negativeProfitCount
                  ? ` Đang hiển thị ${filteredNegativeProfitCount} SKU sau bộ lọc.`
                  : null}
              </p>
            </div>
          </div>
          {profitFilter !== 'loss' ? (
            <button
              type="button"
              onClick={() => resetPageAnd(setProfitFilter, 'loss')}
              className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Chỉ xem SKU đang lỗ
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resetPageAnd(setProfitFilter, 'all')}
              className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Xem tất cả
            </button>
          )}
        </div>
      ) : null}

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {isLoading ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Đang tải...</p>
        ) : pageItems.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Không có dữ liệu</p>
        ) : pageItems.map((row) => (
          <article
            key={row.skuId}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              row.profit < 0 ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{row.skuCode}</p>
                <p className="mt-1 text-xs text-slate-500">Đơn vị: {row.unitName || '—'}</p>
              </div>
              <div className="shrink-0 text-right">
                {row.profit < 0 ? (
                  <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                    <span className="material-symbols-outlined text-[12px]">warning</span>
                    Lỗ
                  </span>
                ) : null}
                <p className={`text-sm font-semibold ${row.profit >= 0 ? 'text-[#356647]' : 'text-rose-600'}`}>
                  {formatVnd(row.profit)}
                </p>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Giá bán</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{formatVnd(row.retailPrice)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Giá vốn TB</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{formatVnd(row.averageCostPrice)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Đơn giá nhập gần nhất</dt>
                <dd className="mt-0.5 text-slate-700">{formatVnd(row.lastPurchaseUnitCost)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Cập nhật giá vốn</dt>
                <dd className="mt-0.5 text-xs text-slate-700">
                  {row.costUpdatedAt ? formatVietnamDateTime(row.costUpdatedAt) : '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-2 text-xs text-slate-600">
              Phiếu nhập:{' '}
              {row.sourceReceiptId ? (
                <Link
                  to={`/inventory/supplier-receipts/${row.sourceReceiptId}`}
                  className="font-semibold text-[#356647] underline underline-offset-2"
                >
                  {row.sourceReceiptCode || 'Xem Phiếu nhập'}
                </Link>
              ) : '—'}
            </div>

            {canEditSalePrice ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giá bán mới</p>
                  <PriceDraftInput
                    value={draftPrices[row.skuId]}
                    onChange={(next) => setDraftPrices((current) => ({ ...current, [row.skuId]: next }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={savingId === row.skuId || parseVndInput(draftPrices[row.skuId]) === row.retailPrice}
                  onClick={() => saveRetailPrice(row)}
                  className="rounded-lg bg-[#538463] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:self-end"
                >
                  {savingId === row.skuId ? 'Đang lưu...' : 'Lưu Giá bán'}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => openHistory(row)}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem lịch sử giá
            </button>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${canEditSalePrice ? 'min-w-[1280px]' : 'min-w-[1100px]'}`}>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Sản Phẩm</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3 text-right">Giá bán hiện tại</th>
                {canEditSalePrice ? <th className="px-4 py-3 text-right">Giá bán mới</th> : null}
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
                <tr><td colSpan={tableColSpan} className="px-4 py-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={tableColSpan} className="px-4 py-8 text-center text-slate-500">Không có dữ liệu</td></tr>
              ) : pageItems.map((row) => (
                <tr
                  key={row.skuId}
                  className={`border-t ${
                    row.profit < 0 ? 'border-rose-100 bg-rose-50/40' : 'border-slate-100'
                  }`}
                >
                  <td className="max-w-[240px] px-4 py-3 text-slate-700">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="font-mono text-xs text-slate-500">{row.skuCode}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.unitName || '—'}</td>
                  <td className="px-4 py-3 text-right">{formatVnd(row.retailPrice)}</td>
                  {canEditSalePrice ? (
                    <td className="px-4 py-3 text-right">
                      <div className="ml-auto">
                        <PriceDraftInput
                          value={draftPrices[row.skuId]}
                          onChange={(next) => setDraftPrices((current) => ({ ...current, [row.skuId]: next }))}
                        />
                      </div>
                    </td>
                  ) : null}
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
                    {row.profit < 0 ? (
                      <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        <span className="material-symbols-outlined text-[12px]">warning</span>
                        Lỗ
                      </span>
                    ) : null}
                    <p>{formatVnd(row.profit)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openHistory(row)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Lịch sử
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
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
          itemLabel="SKU"
        />
      </div>

      {historyState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"
          onClick={() => setHistoryState(null)}
        >
          <div
            className="flex max-h-[min(92dvh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-800 sm:text-lg">
                    Lịch sử giá — {historyState.row.skuCode}
                  </h2>
                  <p className="truncate text-sm text-slate-500">{historyState.row.name}</p>
                  {!historyState.isLoading && !historyState.error ? (
                    <p className="mt-1 text-xs text-slate-400">
                      {historyFilteredItems.length} bản ghi
                      {historyState.totalFromApi > historyState.items.length
                        ? ` (hiển thị ${historyState.items.length}/${historyState.totalFromApi})`
                        : null}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryState(null)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Đóng"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {!historyState.isLoading && !historyState.error && historyState.items.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { value: '', label: 'Tất cả', count: historyTypeCounts.all },
                    { value: 'RetailPrice', label: 'Giá bán', count: historyTypeCounts.RetailPrice },
                    { value: 'AverageCost', label: 'Giá vốn', count: historyTypeCounts.AverageCost },
                  ].map((chip) => {
                    const active = historyState.typeFilter === chip.value
                    return (
                      <button
                        key={chip.value || 'all'}
                        type="button"
                        onClick={() => setHistoryTypeFilter(chip.value)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#356647] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {chip.label}
                        <span className={`ml-1 ${active ? 'text-white/80' : 'text-slate-400'}`}>
                          ({chip.count})
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-0">
              {historyState.isLoading ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">Đang tải lịch sử...</p>
              ) : historyState.error ? (
                <p className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{historyState.error}</p>
              ) : historyState.items.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có lịch sử thay đổi giá.</p>
              ) : historyFilteredItems.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">Không có bản ghi thuộc loại đã chọn.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2.5 sm:px-5">Loại</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right">Cũ → Mới</th>
                      <th className="hidden whitespace-nowrap px-3 py-2.5 md:table-cell">Nguồn / trạng thái</th>
                      <th className="whitespace-nowrap px-3 py-2.5">Thời gian</th>
                      <th className="hidden whitespace-nowrap px-3 py-2.5 pr-5 lg:table-cell">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyPageItems.map((item) => {
                      const status = historyStatusLabel(item)
                      const source = historySourceLabel(item.sourceType)
                      const timeLabel = item.type === 'AverageCost'
                        ? (item.sourceApprovedAt || item.updatedAt || item.changedAt)
                        : item.changedAt
                      return (
                        <tr key={item.id} className="align-top hover:bg-slate-50/80">
                          <td className="px-4 py-2.5 sm:px-5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                item.type === 'RetailPrice'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {item.type === 'RetailPrice' ? 'Giá bán' : 'Giá vốn'}
                            </span>
                            {item.incomingUnitCost != null || item.incomingQuantity != null ? (
                              <p className="mt-1 max-w-[9rem] text-[11px] leading-snug text-slate-400 sm:max-w-none">
                                {item.incomingQuantity != null ? `SL ${item.incomingQuantity}` : null}
                                {item.incomingQuantity != null && item.incomingUnitCost != null ? ' · ' : null}
                                {item.incomingUnitCost != null ? `ĐG ${formatVnd(item.incomingUnitCost)}` : null}
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                            <span className="text-slate-500">{formatVnd(item.oldValue)}</span>
                            <span className="mx-1 text-slate-300">→</span>
                            <span className="font-semibold text-[#356647]">{formatVnd(item.newValue)}</span>
                          </td>
                          <td className="hidden px-3 py-2.5 md:table-cell">
                            <div className="flex max-w-[14rem] flex-col gap-1">
                              {source ? (
                                <span className="w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                                  {source}
                                </span>
                              ) : null}
                              {status ? (
                                <span
                                  className={`w-fit rounded px-1.5 py-0.5 text-[11px] ${
                                    item.wasApplied === true
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {status}
                                </span>
                              ) : null}
                              {item.sourceReceiptId ? (
                                <Link
                                  to={`/inventory/supplier-receipts/${item.sourceReceiptId}`}
                                  className="truncate text-[11px] font-semibold text-[#356647] underline underline-offset-2"
                                >
                                  {item.sourceReceiptCode || 'Phiếu nhập'}
                                </Link>
                              ) : null}
                              {!source && !status && !item.sourceReceiptId ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                            {timeLabel ? formatVietnamDateTime(timeLabel) : '—'}
                          </td>
                          <td className="hidden max-w-[10rem] truncate px-3 py-2.5 pr-5 text-xs text-slate-600 lg:table-cell">
                            {item.changedBy || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!historyState.isLoading && !historyState.error && historyFilteredItems.length > 0 ? (
              <div className="shrink-0 border-t border-slate-100">
                <TablePagination
                  page={historyState.page || 1}
                  pageSize={historyPageSize}
                  pageSizeOptions={historyPageSizeOptions}
                  totalCount={historyFilteredItems.length}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={handleHistoryPageSizeChange}
                  itemLabel="bản ghi"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
