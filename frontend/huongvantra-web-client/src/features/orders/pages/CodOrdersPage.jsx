import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import OpsActionQueue from '../../../components/shared/OpsActionQueue.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { canAccessModule } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CodShiftReportPanel from '../components/CodShiftReportPanel.jsx'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { exportOrdersToExcel, fetchOrders } from '../services/ordersApi.js'
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
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ thu COD' },
  { key: 'overdue', label: 'Quá hạn (>7 ngày)' },
  { key: 'done', label: 'Đã hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
]

function CodOrdersPage() {
  const session = loadAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = searchParams.get('view') === 'report' ? 'report' : 'list'
  const canOpenGeneralOrders = canAccessModule(session, 'orders')
  const canOpenReturns = canAccessModule(session, 'pos') || canAccessModule(session, 'orders')
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    LIST_TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : 'all',
  )
  const [searchValue, setSearchValue] = useState('')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ all: 0, pending: 0, overdue: 0, done: 0, cancelled: 0 })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

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
      const [all, pending, overdue, done, cancelled, activeData] = await Promise.all([
        loadTab('all'),
        loadTab('pending'),
        loadTab('overdue'),
        loadTab('done'),
        loadTab('cancelled'),
        loadTab(activeTab, page, pageSize),
      ])
      setCounts({
        all: all.totalCount,
        pending: pending.totalCount,
        overdue: overdue.totalCount,
        done: done.totalCount,
        cancelled: cancelled.totalCount,
      })
      setOrders(activeData.items)
      setTotalCount(activeData.totalCount)
    } catch (error) {
      setOrders([])
      setCounts({ all: 0, pending: 0, overdue: 0, done: 0, cancelled: 0 })
      setTotalCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, activeView, loadTab, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && LIST_TABS.some((t) => t.key === urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const actionItems = useMemo(
    () => [
      {
        id: 'cod-overdue',
        title: 'COD quá hạn',
        hint: 'Chưa xử lý hơn 7 ngày — ưu tiên thu/đối soát',
        icon: 'warning',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        count: counts.overdue,
        onClick: () => selectListTab('overdue'),
      },
      {
        id: 'cod-pending',
        title: 'COD chờ thu',
        hint: 'Đơn COD chưa xác nhận thu tiền',
        icon: 'local_shipping',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        count: counts.pending,
        onClick: () => selectListTab('pending'),
      },
      {
        id: 'cod-report',
        title: 'Xem báo cáo COD',
        hint: 'Đối soát theo ca hoặc theo khoảng ngày',
        icon: 'summarize',
        alwaysShow: true,
        onClick: () => setActiveView('report'),
      },
    ],
    [counts],
  )

  const listChips = useMemo(
    () => [
      { value: 'all', label: 'Tất cả', count: counts.all },
      { value: 'pending', label: 'Chờ thu', count: counts.pending },
      { value: 'overdue', label: 'Quá hạn', count: counts.overdue },
      { value: 'done', label: 'Đã hoàn tất', count: counts.done },
      { value: 'cancelled', label: 'Đã hủy', count: counts.cancelled },
    ],
    [counts],
  )

  const selectListTab = (key) => {
    setActiveTab(key)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    // Tab mặc định «Tất cả» — không gắn ?tab= trên URL
    if (key === 'all') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  async function handleExportCodOrders() {
    if (isExporting || activeView !== 'list') return
    try {
      setIsExporting(true)
      await exportOrdersToExcel(
        {
          codTab: activeTab !== 'all' ? activeTab : undefined,
          search: searchValue.trim() || undefined,
        },
        'Don_Hang_COD',
      )
      showSuccess('Đã tải file xuất đơn COD.')
    } catch (error) {
      showError(error.message || 'Xuất file đơn COD thất bại.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageShell className="gap-1.5 sm:gap-1.5">
      <PageHeader
        compact
        title="Quản lý đơn COD"
        titleInfo={
          activeView === 'report'
            ? 'Hai chế độ: theo ca đang trực (khung giờ ca) hoặc theo khoảng ngày.'
            : 'Theo dõi đơn kênh COD. Đơn đã hủy nằm ở tab «Đã hủy» (không hiện trong Chờ thu / Quá hạn).'
        }
        searchPlaceholder="Tìm mã đơn, tên khách..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
        inlineContent={
          <div className="flex items-center gap-1">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeView === tab.key
                    ? 'bg-[#538463] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
        rightContent={
          activeView === 'list' ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={isExporting || isLoading}
                onClick={handleExportCodOrders}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
                  ios_share
                </span>
                Export Excel
              </button>
              {canOpenGeneralOrders ? (
                <Link
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  to="/orders"
                >
                  Đơn hàng khác
                </Link>
              ) : null}
            </div>
          ) : canOpenGeneralOrders ? (
            <Link
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              to="/orders"
            >
              Đơn hàng khác
            </Link>
          ) : null
        }
      />

      {activeView === 'report' ? (
        <CodShiftReportPanel searchValue={searchValue} />
      ) : (
        <div className="space-y-3">
          <OpsActionQueue items={actionItems} layout="horizontal" />

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
                      const overdue = activeTab !== 'done'
                        && activeTab !== 'cancelled'
                        && isCodOverdue(order)
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
                              : activeTab === 'done' || activeTab === 'cancelled' || activeTab === 'all'
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
