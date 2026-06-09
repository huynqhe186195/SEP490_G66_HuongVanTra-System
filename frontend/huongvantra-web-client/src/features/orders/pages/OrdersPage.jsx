import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { canAccessModule, canViewStockDeductOps } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateOrder } from '../../auth/utils/permissions.js'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  resolveInventorySyncMeta,
  getOrderChannelLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  ORDER_CHANNEL_OPTIONS,
  ORDER_STATUS_OPTIONS,
} from '../utils/orderDisplay.js'

const initialFilters = {
  search: '',
  status: '',
  channel: '',
}

function OrdersPage() {
  const session = loadAuthSession()
  const canManage = canCreateOrder(session)
  const canManageCod = canAccessModule(session, 'cod_ops')
  const canManageStockDeduct = canViewStockDeductOps(session)

  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const queryParams = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      channel: filters.channel || undefined,
      page,
      pageSize: TABLE_PAGE_SIZE,
    }),
    [filters, page],
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
        }
      } catch (error) {
        if (mounted) {
          setOrders([])
          setTotalCount(0)
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

  const hasActiveFilters = filters.status || filters.channel || filters.search

  return (
    <PageShell className="pb-8">
      <PageHeader
        title="Đơn hàng"
        description="Theo dõi đơn đã tạo từ POS bán hàng. Tạo đơn mới tại màn POS."
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

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái</span>
            <select
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-3 text-sm outline-none focus:border-[#538463]"
              value={filters.status}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, status: e.target.value }))
                setPage(1)
              }}
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-status'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Kênh bán</span>
            <select
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-3 text-sm outline-none focus:border-[#538463]"
              value={filters.channel}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, channel: e.target.value }))
                setPage(1)
              }}
            >
              {ORDER_CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-channel'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setFilters(initialFilters)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}

          {canManageCod ? (
            <Link
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100"
              to="/orders/cod"
            >
              Quản lý COD
            </Link>
          ) : null}
          {canManageStockDeduct ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/10"
              to="/orders/stock-deduct"
            >
              Chờ trừ kho
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
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ghi chú</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kênh</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kho</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ngày tạo</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">Thành tiền</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={9}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={9}>
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
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800">{order.customerSnapshotName || 'Khách lẻ'}</td>
                      <td className="max-w-[200px] px-4 py-4 text-xs text-slate-600">
                        {order.note?.trim() ? (
                          <span className="line-clamp-2" title={order.note}>
                            {order.note}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {getOrderChannelLabel(order.orderChannel)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                          {getOrderStatusLabel(order.orderStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventorySyncMeta.className}`}>
                          {inventorySyncMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatVietnamDateTime(order.createdAt)}</td>
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

        <TablePagination page={page} totalCount={totalCount} itemLabel="đơn" onPageChange={setPage} />
      </section>
    </PageShell>
  )
}

export default OrdersPage
