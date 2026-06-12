import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  resolveInventorySyncMeta,
  getOrderStatusClass,
  getOrderStatusLabel,
  ORDER_STATUS_OPTIONS,
} from '../utils/orderDisplay.js'

function ExchangeOrdersPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      orderKind: 'Exchange',
      page,
      pageSize: TABLE_PAGE_SIZE,
    }),
    [search, status, page],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
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

  return (
    <PageShell className="pb-8">
      <PageHeader
        title="Đơn đổi hàng"
        description="Các đơn phát sinh khi khách trả hàng và mua/đổi sản phẩm khác trong cùng giao dịch."
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            ← Đơn bán hàng
          </Link>
        }
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="min-w-[180px] max-w-xs">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái</span>
          <select
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-3 text-sm outline-none focus:border-[#538463]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
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
      </section>

      <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã đơn đổi</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ghi chú</th>
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
                  <td className="px-6 py-10 text-slate-500" colSpan={8}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={8}>
                    Chưa có đơn đổi hàng.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? orders.map((order) => {
                    const inventorySyncMeta = resolveInventorySyncMeta(order)
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                        <td className="px-6 py-4 font-bold text-slate-700">
                          <Link
                            className="hover:text-[#538463] hover:underline"
                            to={`/orders/${order.id}?from=exchange`}
                          >
                            {order.orderCode}
                          </Link>
                          <span className="ml-2 rounded-full bg-[#538463]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#356647]">
                            Đổi
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <OrderCustomerCell
                            snapshot={order.customerSnapshotName}
                            customerId={order.customerId}
                          />
                        </td>
                        <td className="max-w-[240px] px-4 py-4 text-xs text-slate-600">
                          {order.note?.trim() ? (
                            <span className="line-clamp-2" title={order.note}>
                              {order.note}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
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
                          <Link
                            className="text-sm font-semibold text-[#538463] hover:underline"
                            to={`/orders/${order.id}?from=exchange`}
                          >
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

        <TablePagination page={page} totalCount={totalCount} itemLabel="đơn đổi" onPageChange={setPage} />
      </section>
    </PageShell>
  )
}

export default ExchangeOrdersPage
