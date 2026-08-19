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
import { showError, showSuccess } from '../../../app/toast.js'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { exportOrdersToExcel, fetchOrders } from '../services/ordersApi.js'
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

const initialFilters = {
  search: '',
  status: '',
  fromDate: '',
  toDate: '',
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

function OrdersPage() {
  const session = loadAuthSession()
  const canManage = canCreateOrder(session)
  const canManageStockDeduct = canViewStockDeductOps(session)

  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState(null)
  const [page, setPage] = useState(1)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

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
      excludeChannel: 'COD',
      excludeOrderKind: 'Exchange',
      fromDate: toLocalDayStartIso(filters.fromDate),
      toDate: toLocalDayEndIso(filters.toDate),
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

  const hasActiveFilters = filters.status || filters.fromDate || filters.toDate

  async function handleExportOrders() {
    if (isExporting) return
    try {
      setIsExporting(true)
      await exportOrdersToExcel({
        search: filters.search.trim() || undefined,
        status: filters.status || undefined,
        excludeChannel: 'COD',
        excludeOrderKind: 'Exchange',
        fromDate: toLocalDayStartIso(filters.fromDate),
        toDate: toLocalDayEndIso(filters.toDate),
      })
      showSuccess('Đã tải file export đơn hàng.')
    } catch (error) {
      showError(error.message || 'Export đơn hàng thất bại.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageShell className="gap-1.5 sm:gap-1.5">
      <PageHeader
        compact
        title="Đơn hàng"
        titleInfo="Theo dõi đơn đã tạo từ POS bán hàng. Tạo đơn mới tại màn POS."
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={isExporting || isLoading}
              onClick={handleExportOrders}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
                ios_share
              </span>
              Export Excel
            </button>
            <Link
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              to="/orders/exchange"
            >
              Đơn đổi
            </Link>
            {canManageStockDeduct ? (
              <Link
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                to="/orders/stock-deduct"
              >
                Chờ trừ tồn
              </Link>
            ) : null}
            {canManage ? (
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#457053]"
                to="/pos"
              >
                <span className="material-symbols-outlined text-lg">point_of_sale</span>
                POS bán hàng
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <StatusFilterChips
          options={statusChipOptions}
          value={filters.status}
          onChange={(status) => {
            setFilters((prev) => ({ ...prev, status }))
            setPage(1)
          }}
          className="gap-1.5"
        />

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          Từ
          <input
            type="date"
            aria-label="Từ ngày"
            value={filters.fromDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, fromDate: e.target.value }))
              setPage(1)
            }}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-normal text-slate-700 outline-none focus:border-[#538463]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          Đến
          <input
            type="date"
            aria-label="Đến ngày"
            value={filters.toDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, toDate: e.target.value }))
              setPage(1)
            }}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-normal text-slate-700 outline-none focus:border-[#538463]"
          />
        </label>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: '', fromDate: '', toDate: '' }))
              setPage(1)
            }}
            className="h-8 rounded-full border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Xóa lọc
          </button>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kênh</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Người bán</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kho</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">Thành tiền</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-10" colSpan={7}>
                    <LoadingIndicator />
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={7}>
                    Không có đơn phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? orders.map((order) => {
                    const inventorySyncMeta = resolveInventorySyncMeta(order)
                    return (
                    <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                          {getOrderStatusLabel(order.orderStatus)}
                        </span>
                        {getPickupDueBadge(order) ? (
                          <span className={`mt-1 block w-fit rounded-full px-3 py-1 text-xs font-semibold ${getPickupDueBadge(order).className}`}>
                            {getPickupDueBadge(order).label}
                          </span>
                        ) : null}
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
                      <td className="px-6 py-4 text-right font-bold text-[#356647]">{formatVnd(order.finalAmount)}</td>
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
