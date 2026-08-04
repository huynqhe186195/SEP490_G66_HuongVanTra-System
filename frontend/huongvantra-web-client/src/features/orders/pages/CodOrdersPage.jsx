import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { canAccessModule } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CodShiftReportPanel from '../components/CodShiftReportPanel.jsx'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  getCodDaysPending,
  getOrderStatusClass,
  getOrderStatusLabel,
  isCodOverdue,
} from '../utils/orderDisplay.js'

const VIEW_TABS = [
  { key: 'list', label: 'Danh sách đơn' },
  { key: 'report', label: 'Báo cáo' },
]

const LIST_TABS = [
  { key: 'pending', label: 'Chờ thu COD' },
  { key: 'overdue', label: 'Quá hạn (>7 ngày)' },
  { key: 'done', label: 'Đã hoàn tất' },
]

function CodOrdersPage() {
  const session = loadAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = searchParams.get('view') === 'report' ? 'report' : 'list'
  const canOpenGeneralOrders = canAccessModule(session, 'orders')
  const canOpenReturns = canAccessModule(session, 'pos') || canAccessModule(session, 'orders')
  const [activeTab, setActiveTab] = useState('pending')
  const [searchValue, setSearchValue] = useState('')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ pending: 0, overdue: 0, done: 0 })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)

  const setActiveView = (view) => {
    const next = new URLSearchParams(searchParams)
    if (view === 'report') next.set('view', 'report')
    else next.delete('view')
    setSearchParams(next, { replace: true })
  }

  const loadTab = useCallback(async (codTab, nextPage = 1, nextPageSize = 1) => {
    return fetchOrders({
      codTab,
      search: searchValue.trim() || undefined,
      page: nextPage,
      pageSize: nextPageSize,
    })
  }, [searchValue])

  const loadData = useCallback(async () => {
    if (activeView !== 'list') return
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
  }, [activeTab, activeView, loadTab, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const listCards = useMemo(
    () => [
      {
        key: 'pending',
        label: 'Chờ thu',
        value: counts.pending,
        note: 'Chưa xác nhận thu tiền',
      },
      {
        key: 'overdue',
        label: 'Quá hạn',
        value: counts.overdue,
        note: 'Chưa xử lý > 7 ngày',
        warn: counts.overdue > 0,
      },
      {
        key: 'done',
        label: 'Đã hoàn tất',
        value: counts.done,
        note: 'Đơn COD đã thu',
      },
    ],
    [counts],
  )

  const listChips = useMemo(
    () => [
      { value: 'pending', label: 'Chờ thu', count: counts.pending },
      { value: 'overdue', label: 'Quá hạn', count: counts.overdue },
      { value: 'done', label: 'Đã hoàn tất', count: counts.done },
    ],
    [counts],
  )

  const selectListTab = (key) => {
    setActiveTab(key)
    setPage(1)
  }

  return (
    <PageShell>
      <PageHeader
        compact
        title="Quản lý đơn COD"
        titleInfo={
          activeView === 'report'
            ? 'Hai chế độ: theo ca đang trực (khung giờ ca) hoặc theo khoảng ngày.'
            : 'Theo dõi đơn kênh COD và xác nhận thu tiền tại trang chi tiết đơn hàng.'
        }
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveView(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeView === tab.key
                ? 'bg-[#538463] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {canOpenGeneralOrders ? (
          <Link
            className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            Đơn hàng khác
          </Link>
        ) : null}
      </div>

      {activeView === 'report' ? (
        <CodShiftReportPanel searchValue={searchValue} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {listCards.map((card) => {
              const active = activeTab === card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectListTab(card.key)}
                  className={`rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition ${
                    active
                      ? 'border-[#356647] ring-1 ring-[#356647]/30'
                      : card.warn
                        ? 'border-rose-200 hover:border-rose-300'
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${card.warn ? 'text-rose-700' : 'text-slate-900'}`}>
                    {card.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500" title={card.note}>{card.note}</p>
                </button>
              )
            })}
          </div>

          <StatusFilterChips
            options={listChips}
            value={activeTab}
            onChange={selectListTab}
            ariaLabel="Lọc danh sách COD"
          />

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-bold text-slate-800">
                {LIST_TABS.find((t) => t.key === activeTab)?.label}
                <span className="ml-2 text-xs font-semibold text-slate-400">({totalCount})</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Mã đơn</th>
                    <th className="px-4 py-2.5">Khách</th>
                    <th className="px-4 py-2.5">Người bán</th>
                    <th className="px-4 py-2.5">Trạng thái</th>
                    <th className="px-4 py-2.5">Hạn cảnh báo</th>
                    <th className="px-4 py-2.5 text-right">Thành tiền</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-500" colSpan={7}>
                        Đang tải...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-500" colSpan={7}>
                        Không có đơn trong mục này.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const overdue = activeTab !== 'done' && isCodOverdue(order)
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2.5">
                            <Link
                              to={`/orders/${order.id}?from=cod`}
                              className="font-semibold text-[#356647] underline underline-offset-2"
                            >
                              {order.orderCode}
                            </Link>
                            {order.hasActiveStockReservation ? (
                              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                Giữ chỗ
                              </span>
                            ) : null}
                            {overdue ? (
                              <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                Quá hạn · {getCodDaysPending(order)} ngày
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5">
                            <OrderCustomerCell snapshot={order.customerSnapshotName} customerId={order.customerId} />
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {order.sellerName?.trim() ? order.sellerName : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getOrderStatusClass(order.orderStatus)}`}
                            >
                              {getOrderStatusLabel(order.orderStatus)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">
                            {order.codWarningDate
                              ? formatVietnamDateTime(order.codWarningDate)
                              : activeTab === 'done'
                                ? formatVietnamDateTime(order.createdAt)
                                : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                            {formatVnd(order.finalAmount)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Link
                                to={`/orders/${order.id}?from=cod`}
                                className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Chi tiết
                              </Link>
                              {activeTab === 'done' && canOpenReturns ? (
                                <Link
                                  to={`/pos/returns/${order.id}`}
                                  className="inline-flex rounded-lg border border-[#538463]/30 bg-[#f6f4ec] px-2.5 py-1 text-xs font-semibold text-[#356647] hover:bg-[#ebe8dc]"
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
              pageSizeOptions={pageSizeOptions}
              totalCount={totalCount}
              itemLabel="đơn COD"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              disabled={isLoading}
            />
          </section>
        </div>
      )}
    </PageShell>
  )
}

export default CodOrdersPage
