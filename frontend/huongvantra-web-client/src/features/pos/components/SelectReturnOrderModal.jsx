import { useCallback, useEffect, useMemo, useState } from 'react'
import { addUtcPlus7, formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchOrder, fetchOrders } from '../../orders/services/ordersApi.js'
import { formatVnd } from '../../orders/utils/orderDisplay.js'
import { showError } from '../../../app/toast.js'

const PAGE_SIZE = 7

const initialFilters = {
  invoiceCode: '',
  waybillCode: '',
  customer: '',
  productCode: '',
  productName: '',
  dateFrom: '',
  dateTo: '',
}

function toDateInputValue(date) {
  const vn = addUtcPlus7(date)
  if (!vn) return ''
  const y = vn.getUTCFullYear()
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0')
  const d = String(vn.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function defaultDateFrom() {
  const now = addUtcPlus7(new Date())
  if (!now) return ''
  const past = new Date(now.getTime())
  past.setUTCDate(past.getUTCDate() - 30)
  return toDateInputValue(past)
}

function defaultDateTo() {
  return toDateInputValue(new Date())
}

function parseDateInputToUtcStart(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 60 * 60 * 1000)
}

function parseDateInputToUtcEnd(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 7 * 60 * 60 * 1000)
}

function isOrderInDateRange(createdAt, fromStr, toStr) {
  const orderUtc = addUtcPlus7(createdAt)
  if (!orderUtc) return true
  const orderTime = orderUtc.getTime() - 7 * 60 * 60 * 1000

  const fromUtc = parseDateInputToUtcStart(fromStr)
  if (fromUtc && orderTime < fromUtc.getTime()) return false

  const toUtc = parseDateInputToUtcEnd(toStr)
  if (toUtc && orderTime > toUtc.getTime()) return false

  return true
}

function orderMatchesProductFilter(orderDetail, productCode, productName) {
  const codeQ = productCode.trim().toLowerCase()
  const nameQ = productName.trim().toLowerCase()
  if (!codeQ && !nameQ) return true
  const items = orderDetail?.items ?? []
  return items.some((line) => {
    const code = String(line.skuSnapshotCode || '').toLowerCase()
    const name = String(line.skuSnapshotName || '').toLowerCase()
    if (codeQ && code.includes(codeQ)) return true
    if (nameQ && name.includes(nameQ)) return true
    return false
  })
}

function buildServerSearch(filters) {
  const invoice = String(filters.invoiceCode || '').trim()
  if (invoice) return invoice

  const waybill = String(filters.waybillCode || '').trim()
  if (waybill) return waybill

  const customer = String(filters.customer || '').trim()
  if (customer) return customer

  const productCode = String(filters.productCode || '').trim()
  if (productCode) return productCode

  const productName = String(filters.productName || '').trim()
  if (productName) return productName

  return undefined
}

function ReturnOrderPagination({ page, totalPages, totalCount, pageSize, onPageChange }) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))
  const from = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalCount)

  const pageNumbers = useMemo(() => {
    const maxButtons = 5
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    let start = Math.max(1, safePage - 2)
    let end = Math.min(totalPages, start + maxButtons - 1)
    start = Math.max(1, end - maxButtons + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [safePage, totalPages])

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 sm:text-sm">
        Hiển thị <span className="font-semibold text-slate-800">{from}</span> –{' '}
        <span className="font-semibold text-slate-800">{to}</span> trên tổng số{' '}
        <span className="font-semibold text-slate-800">{totalCount}</span> hóa đơn
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          aria-label="Trang đầu"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
        </button>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          aria-label="Trang trước"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm font-semibold ${
              n === safePage ? 'bg-[#538463] text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          aria-label="Trang sau"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          aria-label="Trang cuối"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_right</span>
        </button>
      </div>
    </div>
  )
}

const CHANNEL_TABS = [
  { id: 'POS', label: 'Tại quầy' },
  { id: 'COD', label: 'COD (giao hàng)' },
]

function SelectReturnOrderModal({ isOpen, onClose, onSelectOrder, onQuickReturn }) {
  const [orderChannel, setOrderChannel] = useState('POS')
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    dateFrom: defaultDateFrom(),
    dateTo: defaultDateTo(),
  }))
  const [draftFilters, setDraftFilters] = useState(filters)
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const hasProductFilter = Boolean(draftFilters.productCode.trim() || draftFilters.productName.trim())

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const search = buildServerSearch(draftFilters)
      const data = await fetchOrders({
        search,
        status: 'Completed',
        channel: orderChannel,
        returnableOnly: true,
        excludeOrderKind: 'Exchange',
        fromDate: draftFilters.dateFrom || undefined,
        toDate: draftFilters.dateTo || undefined,
        page: hasProductFilter ? 1 : page,
        pageSize: hasProductFilter ? 200 : PAGE_SIZE,
      })

      let items = data.items

      if (hasProductFilter) {
        const details = await Promise.all(
          items.map(async (order) => {
            try {
              return await fetchOrder(order.id)
            } catch {
              return null
            }
          }),
        )
        items = items.filter((order, index) =>
          orderMatchesProductFilter(details[index], draftFilters.productCode, draftFilters.productName),
        )
        const start = (page - 1) * PAGE_SIZE
        const paged = items.slice(start, start + PAGE_SIZE)
        setOrders(paged)
        setTotalCount(items.length)
      } else {
        setOrders(items)
        setTotalCount(data.totalCount)
      }
    } catch (error) {
      setOrders([])
      setTotalCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [draftFilters, hasProductFilter, orderChannel, page])

  useEffect(() => {
    if (!isOpen) return
    setOrderChannel('POS')
    setDraftFilters({
      ...initialFilters,
      dateFrom: defaultDateFrom(),
      dateTo: defaultDateTo(),
    })
    setFilters({
      ...initialFilters,
      dateFrom: defaultDateFrom(),
      dateTo: defaultDateTo(),
    })
    setPage(1)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => {
      setDraftFilters(filters)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [filters, isOpen])

  useEffect(() => {
    if (!isOpen) return
    loadOrders()
  }, [isOpen, loadOrders])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (!isOpen) return null

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-2 sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-[min(1120px,98vw)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 sm:text-lg">Chọn hóa đơn trả hàng</h2>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {CHANNEL_TABS.map((tab) => {
                const active = orderChannel === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setOrderChannel(tab.id)
                      setPage(1)
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-white text-[#356647] shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="shrink-0 border-b border-[#c1c9c0]/60 bg-[#f6f4ec] p-4 lg:w-56 lg:border-b-0 lg:border-r">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">Tìm kiếm</p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Theo mã hóa đơn"
                value={filters.invoiceCode}
                onChange={(e) => updateFilter('invoiceCode', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
              <input
                type="text"
                placeholder="Theo mã vận đơn bán"
                value={filters.waybillCode}
                onChange={(e) => updateFilter('waybillCode', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
              <input
                type="text"
                placeholder="Theo khách hàng hoặc ĐT"
                value={filters.customer}
                onChange={(e) => updateFilter('customer', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
              <input
                type="text"
                placeholder="Theo mã hàng"
                value={filters.productCode}
                onChange={(e) => updateFilter('productCode', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
              <input
                type="text"
                placeholder="Theo tên hàng"
                value={filters.productName}
                onChange={(e) => updateFilter('productName', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
            </div>

            <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-slate-700">Thời gian</p>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                placeholder="Đến ngày"
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
              />
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#538463] text-left text-white">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Mã hóa đơn</th>
                    <th className="px-3 py-2.5 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        Thời gian
                        <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                      </span>
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Nhân viên</th>
                    <th className="px-3 py-2.5 font-semibold">Khách hàng</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tổng cộng</th>
                    <th className="w-24 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                        Đang tải hóa đơn...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                        Không có hóa đơn còn hàng để trả phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(order)}
                            className="font-semibold text-[#356647] hover:underline"
                          >
                            {order.orderCode}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{formatVietnamDateTime(order.createdAt)}</td>
                        <td className="px-3 py-2.5 text-slate-500">—</td>
                        <td className="px-3 py-2.5 text-slate-700">{order.customerSnapshotName || 'Khách lẻ'}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">{formatVnd(order.finalAmount)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(order)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Chọn
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <ReturnOrderPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => onQuickReturn?.()}
            className="rounded-lg bg-[#356647] px-6 py-2 text-sm font-semibold text-white hover:bg-[#2d553c]"
          >
            Trả nhanh
          </button>
        </footer>
      </div>
    </div>
  )
}

export default SelectReturnOrderModal
