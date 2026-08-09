import { useCallback, useEffect, useMemo, useState } from 'react'
import ListFilterToolbar, { listFilterControlClass } from '../../../components/shared/ListFilterToolbar.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchInventoryLedger } from '../services/inventoryLedgerApi.js'

const LOCATION_OPTIONS = [
  { value: '', label: 'Tất cả vị trí' },
  { value: 'Warehouse', label: 'Kho' },
  { value: 'Shelf', label: 'Quầy/Kệ hàng' },
]

const TRANSACTION_OPTIONS = [
  { value: '', label: 'Tất cả GD' },
  { value: 'SUPPLIER_RECEIPT', label: 'Nhập NCC' },
  { value: 'SHELF_REPLENISHMENT_OUT', label: 'Xuất Kho → Quầy' },
  { value: 'SHELF_REPLENISHMENT_IN', label: 'Nhập Quầy từ Kho' },
  { value: 'STOCKTAKE_ADJUSTMENT', label: 'Kiểm kê' },
  { value: 'PRODUCTION_CONSUME', label: 'SX tiêu hao' },
  { value: 'PRODUCTION_RECEIPT', label: 'Nhập sau SX' },
]

function getLocationLabel(location) {
  if (location === 'Warehouse') return 'Kho'
  if (location === 'Shelf') return 'Quầy/Kệ hàng'
  return location || '—'
}

function getTransactionLabel(type) {
  return TRANSACTION_OPTIONS.find((item) => item.value === type)?.label || type || '—'
}

function toCsvValue(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function InventoryLedgerPage() {
  const [searchInput, setSearchInput] = useState('')
  const [location, setLocation] = useState('')
  const [transactionType, setTransactionType] = useState('')
  const [referenceCode, setReferenceCode] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(data.totalItems)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((data.totalItems || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [data.totalItems, pageSize, page])

  const fromUtc = useMemo(() => (fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined), [fromDate])
  const toUtc = useMemo(() => (toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined), [toDate])

  const loadLedger = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchInventoryLedger({
        search: searchInput.trim() || undefined,
        location: location || undefined,
        transactionType: transactionType || undefined,
        referenceCode: referenceCode.trim() || undefined,
        fromUtc,
        toUtc,
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
  }, [fromUtc, location, page, pageSize, referenceCode, searchInput, toUtc, transactionType])

  useEffect(() => {
    const timer = setTimeout(loadLedger, 250)
    return () => clearTimeout(timer)
  }, [loadLedger])

  function exportCsv() {
    const rows = [
      ['SKU', 'Tên hàng', 'Thời gian tạo', 'Vị trí', 'Tồn trước', 'Chênh lệch', 'Tồn sau', 'Loại giao dịch', 'Tham chiếu', 'Mã lô', 'Người thực hiện'],
      ...data.items.map((entry) => [
        entry.skuCode,
        entry.skuNameSnapshot,
        entry.occurredAtUtc,
        getLocationLabel(entry.location),
        entry.quantityBefore,
        entry.quantityDelta,
        entry.quantityAfter,
        getTransactionLabel(entry.transactionType),
        entry.referenceCode,
        entry.lotCode,
        entry.actorName,
      ]),
    ]
    const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventory-ledger.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function resetPageAndSet(setter, value) {
    setter(value)
    setPage(1)
  }

  return (
    <PageShell>
      <PageHeader
        compact
        title="Nhật ký kho"
        titleInfo="Nhật ký bất biến các lần thay đổi tồn Kho/Quầy/Kệ hàng."
        searchPlaceholder="Tìm SKU, tên hàng, mã chứng từ, mã lô..."
        searchValue={searchInput}
        onSearchChange={(value) => resetPageAndSet(setSearchInput, value)}
        rightContent={(
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất CSV
          </button>
        )}
      />

      <ListFilterToolbar>
        <StatusFilterChips
          dense
          options={LOCATION_OPTIONS}
          value={location}
          onChange={(value) => resetPageAndSet(setLocation, value)}
          ariaLabel="Lọc theo vị trí"
        />
        <select
          aria-label="Lọc theo loại giao dịch"
          className={`max-w-[11rem] sm:max-w-[14rem] ${listFilterControlClass}`}
          value={transactionType}
          onChange={(event) => resetPageAndSet(setTransactionType, event.target.value)}
        >
          {TRANSACTION_OPTIONS.map((option) => (
            <option key={option.value || 'all-txn'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          className={`min-w-[8rem] max-w-[10rem] ${listFilterControlClass}`}
          placeholder="Mã chứng từ"
          value={referenceCode}
          onChange={(event) => resetPageAndSet(setReferenceCode, event.target.value)}
        />
        <input
          type="date"
          aria-label="Từ ngày"
          className={listFilterControlClass}
          value={fromDate}
          onChange={(event) => resetPageAndSet(setFromDate, event.target.value)}
        />
        <input
          type="date"
          aria-label="Đến ngày"
          className={listFilterControlClass}
          value={toDate}
          onChange={(event) => resetPageAndSet(setToDate, event.target.value)}
        />
      </ListFilterToolbar>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Sản Phẩm</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3 text-right">Trước</th>
                <th className="px-4 py-3 text-right">+/−</th>
                <th className="px-4 py-3 text-right">Sau</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Tham chiếu</th>
                <th className="px-4 py-3">Người thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-8 text-slate-500">Đang tải...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-8 text-slate-500">Chưa có dòng nhật ký phù hợp.</td></tr>
              ) : (
                data.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-[#356647]">{entry.skuCode}</p>
                      <p className="text-xs text-slate-600">{entry.skuNameSnapshot || '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(entry.occurredAtUtc)}</td>
                    <td className="px-4 py-4">{getLocationLabel(entry.location)}</td>
                    <td className="px-4 py-4 text-right">{formatStockQuantity(entry.quantityBefore)}</td>
                    <td className={`px-4 py-4 text-right font-semibold ${entry.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {entry.quantityDelta >= 0 ? '+' : ''}{formatStockQuantity(entry.quantityDelta)}
                    </td>
                    <td className="px-4 py-4 text-right">{formatStockQuantity(entry.quantityAfter)}</td>
                    <td className="px-4 py-4">{getTransactionLabel(entry.transactionType)}</td>
                    <td className="px-4 py-4 font-mono text-slate-700">{entry.referenceCode || entry.lotCode || '—'}</td>
                    <td className="px-4 py-4 text-slate-700">{entry.actorName || '—'}</td>
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
          totalCount={data.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="dòng nhật ký"
        />
      </section>
    </PageShell>
  )
}

export default InventoryLedgerPage
