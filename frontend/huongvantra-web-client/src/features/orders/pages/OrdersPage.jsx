import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import LoadingIndicator from '../../../components/shared/LoadingIndicator.jsx'
import { canViewStockDeductOps } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateOrder } from '../../auth/utils/permissions.js'
import { showError } from '../../../app/toast.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  resolveInventorySyncMeta,
  getOrderChannelClass,
  getOrderChannelLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPickupDueBadge,
} from '../utils/orderDisplay.js'

const ORDER_STATUS_CHIPS = [
  { value: '', label: 'Tất cả' },
  { value: 'Processing', label: 'Đang xử lý' },
  { value: 'PendingPayment', label: 'Chờ thanh toán' },
  { value: 'WaitingMaterials', label: 'Chờ nguyên liệu' },
  { value: 'WaitingTransfer', label: 'Chờ điều chuyển' },
  { value: 'WaitingProduction', label: 'Chờ sản xuất' },
  { value: 'ReadyToDeliver', label: 'Sẵn sàng giao' },
  { value: 'CancellationRequested', label: 'Chờ duyệt hủy' },
  { value: 'Shipping', label: 'Đang giao' },
  { value: 'Completed', label: 'Hoàn tất' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

const ORDER_CHANNEL_CHIPS = [
  { value: '', label: 'Tất cả kênh' },
  { value: 'POS', label: 'POS' },
  { value: 'B2B', label: 'B2B' },
  { value: 'Website', label: 'Website' },
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Phone', label: 'Điện thoại' },
]

const QUICK_DATE_CHIPS = [
  { value: '', label: 'Tùy chọn' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'last7', label: '7 ngày' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
]

const initialFilters = {
  search: '',
  status: '',
  channel: '',
  fromDate: '',
  toDate: '',
  // POS-04 (truy vết giữ chỗ): chỉ hiển thị đơn đang giữ chỗ tồn Kệ Hàng.
  hasActiveReservation: false,
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toLocalDayStartIso(value) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function toLocalDayEndIso(value) {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function getQuickDateRange(type) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (type === 'today') {
    const value = toDateInputValue(today)
    return { fromDate: value, toDate: value }
  }

  if (type === 'last7') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { fromDate: toDateInputValue(from), toDate: toDateInputValue(today) }
  }

  if (type === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { fromDate: toDateInputValue(from), toDate: toDateInputValue(today) }
  }

  if (type === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) }
  }

  return { fromDate: '', toDate: '' }
}

function OrdersPage() {
  const session = loadAuthSession()
  const canManage = canCreateOrder(session)
  const canManageStockDeduct = canViewStockDeductOps(session)

  const [filters, setFilters] = useState(initialFilters)
  const [quickDateKey, setQuickDateKey] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState(null)
  const [page, setPage] = useState(1)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])

  const statusChipOptions = useMemo(
    () => applyStatusCounts(ORDER_STATUS_CHIPS, statusCounts),
    [statusCounts],
  )

  const queryParams = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      channel: filters.channel || undefined,
      excludeChannel: filters.channel ? undefined : 'COD',
      excludeOrderKind: 'Exchange',
      fromDate: toLocalDayStartIso(filters.fromDate),
      toDate: toLocalDayEndIso(filters.toDate),
      hasActiveReservation: filters.hasActiveReservation || undefined,
      page,
      pageSize,
    }),
    [filters, page, pageSize],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }))
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        const data = await fetchOrders(queryParams)
        if (mounted) {
          setOrders(data.items)
          setTotalCount(data.totalCount)
          setStatusCounts(data.statusCounts)
        }
      } catch (error) {
        if (mounted) {
          setOrders([])
          setTotalCount(0)
          setStatusCounts(null)
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [queryParams])

  const hasActiveFilters =
    filters.status ||
    filters.channel ||
    filters.search ||
    filters.fromDate ||
    filters.toDate ||
    filters.hasActiveReservation

  return (
    <PageShell className="pb-8">
      <PageHeader
        compact
        title="Đơn hàng"
        titleInfo="Theo dõi đơn đã tạo từ POS bán hàng. Tạo đơn mới tại màn POS."
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          canManage ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#457053]"
              to="/pos"
            >
              <span className="material-symbols-outlined text-lg">point_of_sale</span>
              POS bán hàng
            </Link>
          ) : null
        }
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2.5 space-y-2">
          <StatusFilterChips
            options={statusChipOptions}
            value={filters.status}
            onChange={(status) => {
              setFilters((prev) => ({ ...prev, status }))
              setPage(1)
            }}
          />
          <StatusFilterChips
            options={ORDER_CHANNEL_CHIPS}
            value={filters.channel}
            onChange={(channel) => {
              setFilters((prev) => ({ ...prev, channel }))
              setPage(1)
            }}
            ariaLabel="Lọc theo kênh bán"
          />
          <StatusFilterChips
            options={QUICK_DATE_CHIPS}
            value={quickDateKey}
            onChange={(key) => {
              setQuickDateKey(key)
              setFilters((prev) => ({ ...prev, ...getQuickDateRange(key) }))
              setPage(1)
            }}
            ariaLabel="Khoảng thời gian nhanh"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[150px]">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Từ ngày</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => {
                setQuickDateKey('')
                setFilters((prev) => ({ ...prev, fromDate: e.target.value }))
                setPage(1)
              }}
              className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-2.5 text-sm outline-none focus:border-[#538463]"
            />
          </label>

          <label className="min-w-[150px]">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Đến ngày</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => {
                setQuickDateKey('')
                setFilters((prev) => ({ ...prev, toDate: e.target.value }))
                setPage(1)
              }}
              className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-2.5 text-sm outline-none focus:border-[#538463]"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setFilters((prev) => ({ ...prev, hasActiveReservation: !prev.hasActiveReservation }))
              setPage(1)
            }}
            aria-pressed={filters.hasActiveReservation}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              filters.hasActiveReservation
                ? 'border-amber-300 bg-amber-100 text-amber-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            Có hàng đang giữ
          </button>

          <button
            type="button"
            onClick={() => {
              setFilters((prev) => ({ ...prev, channel: prev.channel === 'B2B' ? '' : 'B2B' }))
              setPage(1)
            }}
            aria-pressed={filters.channel === 'B2B'}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              filters.channel === 'B2B'
                ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">description</span>
            Đơn hợp đồng
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setQuickDateKey('')
                setFilters(initialFilters)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}

          <Link
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/10"
            to="/orders/exchange"
          >
            Đơn đổi hàng
          </Link>
          {canManageStockDeduct ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/10"
              to="/orders/stock-deduct"
            >
              Chờ trừ tồn quầy
            </Link>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã đơn</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kênh</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Người bán</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kho</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ngày tạo</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">Thành tiền</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ghi chú</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-10" colSpan={10}>
                    <LoadingIndicator />
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={10}>
                    Không có đơn phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? orders.map((order) => {
                    const inventorySyncMeta = resolveInventorySyncMeta(order)
                    return (
                    <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-6 py-4 font-bold text-slate-700">
                        <Link className="hover:text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                          {order.orderCode}
                        </Link>
                        {order.hasActiveStockReservation ? (
                          <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                            Đang giữ hàng
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <OrderCustomerCell
                          snapshot={order.customerSnapshotName}
                          customerId={order.customerId}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                          {getOrderStatusLabel(order.orderStatus)}
                        </span>
                        {getPickupDueBadge(order) ? (
                          <span className={`mt-1 block w-fit rounded-full px-3 py-1 text-xs font-semibold ${getPickupDueBadge(order).className}`}>
                            {getPickupDueBadge(order).label}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderChannelClass(order.orderChannel)}`}>
                          {getOrderChannelLabel(order.orderChannel)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {order.sellerName?.trim() ? order.sellerName : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventorySyncMeta.className}`}>
                          {inventorySyncMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatVietnamDateTime(order.createdAt)}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#356647]">{formatVnd(order.finalAmount)}</td>
                      <td className="max-w-[200px] px-4 py-4 text-xs text-slate-600">
                        {order.note?.trim() ? (
                          <span className="line-clamp-2" title={order.note}>
                            {order.note}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link className="text-sm font-semibold text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="đơn"
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

export default OrdersPage
