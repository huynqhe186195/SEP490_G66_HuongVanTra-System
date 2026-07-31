import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { canAccessModule } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  getCodDaysPending,
  getOrderStatusClass,
  getOrderStatusLabel,
  isCodOverdue,
} from '../utils/orderDisplay.js'

const TABS = [
  { key: 'pending', label: 'Chờ thu COD' },
  { key: 'overdue', label: 'Quá hạn (>7 ngày)' },
  { key: 'done', label: 'Đã hoàn tất' },
]

function CodOrdersPage() {
  const session = loadAuthSession()
  const canOpenGeneralOrders = canAccessModule(session, 'orders')
  const canOpenReturns = canAccessModule(session, 'pos') || canAccessModule(session, 'orders')
  const [activeTab, setActiveTab] = useState('pending')
  const [searchValue, setSearchValue] = useState('')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ pending: 0, overdue: 0, done: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadTab = useCallback(async (codTab, nextPage = 1, nextPageSize = 1) => {
    return fetchOrders({
      codTab,
      search: searchValue.trim() || undefined,
      page: nextPage,
      pageSize: nextPageSize,
    })
  }, [searchValue])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pending, overdue, done, activeData] = await Promise.all([
        loadTab('pending'),
        loadTab('overdue'),
        loadTab('done'),
        loadTab(activeTab, page, pageSize),
      ])
      setCounts({
        pending: pending.totalCount,
        overdue: overdue.totalCount,
        done: done.totalCount,
      })
      setOrders(activeData.items)
      setTotalCount(activeData.totalCount)
    } catch (error) {
      setOrders([])
      setCounts({ pending: 0, overdue: 0, done: 0 })
      setTotalCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, loadTab, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = useMemo(
    () => [
      { label: 'Chờ thu COD', value: String(counts.pending), note: 'Chưa xác nhận thu tiền' },
      {
        label: 'Quá hạn',
        value: String(counts.overdue),
        note: 'Quá 7 ngày chưa xử lý',
        warning: counts.overdue > 0,
      },
      { label: 'Hoàn tất', value: String(counts.done), note: 'Đơn COD đã thu' },
    ],
    [counts],
  )

  return (
    <PageShell>
      <PageHeader
        title="Quản lý đơn COD"
        titleInfo="Theo dõi đơn kênh COD và xác nhận thu tiền tại trang chi tiết đơn hàng."
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key)
              setPage(1)
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
            {tab.key === 'overdue' && counts.overdue > 0 ? (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-amber-950">
                {counts.overdue}
              </span>
            ) : null}
          </button>
        ))}
        {canOpenGeneralOrders ? (
          <Link
            className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            Đơn hàng khác
          </Link>
        ) : (
          <div className="ml-auto" />
        )}
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-5 shadow-sm ${
              stat.warning ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">{TABS.find((t) => t.key === activeTab)?.label}</h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Khách hàng</th>
                <th className="px-4 py-4">Người bán</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Hạn cảnh báo</th>
                <th className="px-8 py-4 text-right">Thành tiền</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={7}>
                    Đang tải...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={7}>
                    Không có đơn trong mục này.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const overdue = activeTab !== 'done' && isCodOverdue(order)
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">
                        {order.orderCode}
                        {order.hasActiveStockReservation ? (
                          <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                            Đang giữ hàng
                          </span>
                        ) : null}
                        {overdue ? (
                          <span className="mt-1 block text-xs font-normal text-amber-700">
                            Quá hạn · {getCodDaysPending(order)} ngày
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <OrderCustomerCell snapshot={order.customerSnapshotName} customerId={order.customerId} />
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-700">
                        {order.sellerName?.trim() ? order.sellerName : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}
                        >
                          {getOrderStatusLabel(order.orderStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-600">
                        {order.codWarningDate
                          ? formatVietnamDateTime(order.codWarningDate)
                          : activeTab === 'done'
                            ? formatVietnamDateTime(order.createdAt)
                            : '—'}
                      </td>
                      <td className="px-8 py-5 text-right font-bold text-slate-800">
                        {formatVnd(order.finalAmount)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`/orders/${order.id}?from=cod`}
                            className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Chi tiết
                          </Link>
                          {activeTab === 'done' && canOpenReturns ? (
                            <Link
                              to={`/pos/returns/${order.id}`}
                              className="inline-flex rounded-lg border border-[#538463]/30 bg-[#f6f4ec] px-3 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#ebe8dc]"
                            >
                              Trả / Đổi
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          itemLabel="đơn COD"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
    </PageShell>
  )
}

export default CodOrdersPage
