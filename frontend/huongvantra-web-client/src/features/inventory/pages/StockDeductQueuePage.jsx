import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import OpsActionQueue from '../../../components/shared/OpsActionQueue.jsx'
import OpsSnapshotStrip from '../../../components/shared/OpsSnapshotStrip.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { canAccessPath, canCancelStockDeduct, canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import StockDeductPreviewModal from '../components/StockDeductPreviewModal.jsx'
import { fetchPendingStockDeductQueues } from '../services/stockDeductQueueApi.js'
import {
  formatVnd,
  getOrderStatusClass,
  getOrderStatusLabel,
  getQueueStatusLabel,
  getStockStatusClass,
  getStockStatusLabel,
} from '../../orders/utils/orderDisplay.js'

const TABS = [
  { value: 'waiting', label: 'Chờ đóng gói', status: 'waiting' },
  { value: 'insufficient', label: 'Chờ hàng', status: 'insufficient' },
  { value: 'confirmed', label: 'Đã trừ', status: 'confirmed' },
  { value: 'cancelled', label: 'Đã hủy', status: 'cancelled' },
  { value: 'all', label: 'Tất cả', status: undefined },
]

function getStockDeductTabLabel(tab) {
  if (tab?.value === 'waiting') return 'Chờ đóng gói'
  if (tab?.value === 'insufficient') return 'Chờ nguyên liệu'
  return tab?.label ?? ''
}

/** Đọc count từ statusCounts API không phân biệt hoa/thường (key có thể là enum string). */
function readCount(statusCounts, key) {
  if (!statusCounts) return 0
  const found = Object.entries(statusCounts).find(([k]) => String(k).toLowerCase() === key.toLowerCase())
  return found ? Number(found[1]) || 0 : 0
}

function StockDeductQueuePage() {
  const session = loadAuthSession()
  const canExecuteDeduct = canConfirmStockDeduct(session)
  const canCancelQueue = canCancelStockDeduct(session)
  const canOpenOrders = canAccessPath(session, '/orders')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.value === tabFromUrl) ? tabFromUrl : 'waiting',
  )
  const [searchValue, setSearchValue] = useState('')
  const [queues, setQueues] = useState([])
  const [statusCounts, setStatusCounts] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [previewQueue, setPreviewQueue] = useState(null)

  const tabChipOptions = useMemo(() => {
    if (!statusCounts) return TABS.map((tab) => ({ value: tab.value, label: getStockDeductTabLabel(tab) }))
    const seen = new Set()
    let all = 0
    for (const [key, value] of Object.entries(statusCounts)) {
      const lower = String(key).toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      all += Number(value) || 0
    }
    return applyStatusCounts(
      TABS.map((tab) => ({ value: tab.value, label: getStockDeductTabLabel(tab) })),
      { ...statusCounts, all },
    )
  }, [statusCounts])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = TABS.find((t) => t.value === activeTab)
      const items = await fetchPendingStockDeductQueues({
        status: tab?.status,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      setQueues(items.items)
      setTotalCount(items.totalCount)
      setStatusCounts(items.statusCounts)
    } catch (error) {
      setQueues([])
      setTotalCount(0)
      setStatusCounts(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchValue, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && TABS.some((t) => t.value === urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const selectTab = useCallback((value) => {
    setActiveTab(value)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (value === 'waiting') next.delete('tab')
    else next.set('tab', value)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const waitingCount = readCount(statusCounts, 'waiting')
  const insufficientCount = readCount(statusCounts, 'insufficient')
  const confirmedCount = readCount(statusCounts, 'confirmed')
  const cancelledCount = readCount(statusCounts, 'cancelled')
  const allCount = waitingCount + insufficientCount + confirmedCount + cancelledCount

  const snapshotItems = useMemo(
    () => [
      {
        id: 'waiting',
        label: 'Chờ đóng gói',
        value: waitingCount,
        active: activeTab === 'waiting',
        onClick: () => selectTab('waiting'),
      },
      {
        id: 'insufficient',
        label: 'Chờ nguyên liệu',
        value: insufficientCount,
        warn: insufficientCount > 0,
        active: activeTab === 'insufficient',
        onClick: () => selectTab('insufficient'),
      },
      {
        id: 'confirmed',
        label: 'Đã trừ',
        value: confirmedCount,
        active: activeTab === 'confirmed',
        onClick: () => selectTab('confirmed'),
      },
      {
        id: 'all',
        label: 'Tất cả',
        value: allCount,
        active: activeTab === 'all',
        onClick: () => selectTab('all'),
      },
    ],
    [activeTab, waitingCount, insufficientCount, confirmedCount, allCount, selectTab],
  )

  const actionItems = useMemo(
    () => [
      canExecuteDeduct && {
        id: 'confirm-waiting',
        title: 'Xác nhận đóng gói',
        hint: 'Yêu cầu đang chờ đóng gói / trừ Kho',
        icon: 'inventory_2',
        iconBg: 'bg-[#eaf4eb]',
        iconColor: 'text-[#356647]',
        count: waitingCount,
        onClick: () => selectTab('waiting'),
      },
      {
        id: 'insufficient-material',
        title: 'Chờ nguyên liệu',
        hint: 'Thiếu tồn Kho, chưa thể đóng gói',
        icon: 'warning',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        count: insufficientCount,
        onClick: () => selectTab('insufficient'),
      },
      canOpenOrders && {
        id: 'view-orders',
        title: 'Xem tất cả đơn hàng',
        hint: 'Theo dõi toàn bộ đơn hàng trong hệ thống',
        icon: 'receipt_long',
        alwaysShow: true,
        to: '/orders',
      },
    ].filter(Boolean),
    [canExecuteDeduct, canOpenOrders, waitingCount, insufficientCount, selectTab],
  )

  return (
    <PageShell>
      <PageHeader
        compact
        title="Chờ đóng gói / trừ Kho"
        titleInfo={
          canExecuteDeduct
            ? 'Thủ kho xác nhận đóng gói và trừ nguyên liệu Kho theo yêu cầu đóng gói.'
            : canCancelQueue
              ? 'Theo dõi yêu cầu đóng gói; Quản lý hoặc Admin chỉ hủy khi xử lý ngoại lệ.'
              : 'Theo dõi yêu cầu đóng gói theo quyền được cấp.'
        }
        searchPlaceholder="Tìm mã đơn..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <OpsSnapshotStrip items={snapshotItems} className="mb-3" />

      <OpsActionQueue items={actionItems} className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StatusFilterChips
          options={tabChipOptions}
          value={activeTab}
          onChange={selectTab}
        />
        {canOpenOrders ? (
          <Link
            className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            Tất cả đơn hàng
          </Link>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            {getStockDeductTabLabel(TABS.find((t) => t.value === activeTab))}
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Trạng thái đóng gói</th>
                <th className="px-4 py-4">Tồn cần đối soát</th>
                <th className="px-4 py-4">Trạng thái đơn</th>
                <th className="px-4 py-4">Ngày tạo yêu cầu</th>
                <th className="px-8 py-4 text-right">Tổng tiền</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-center text-slate-500" colSpan={7}>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải yêu cầu đóng gói...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!isLoading && queues.length === 0 ? (
                <tr>
                  <td className="px-8 py-12 text-center" colSpan={7}>
                    <p className="font-semibold text-slate-800">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Không có yêu cầu trong mục này'
                        : 'Chưa có yêu cầu chờ đóng gói'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Thử đổi tab hoặc xóa mã đơn đang tìm.'
                        : 'Khi POS bán vượt tồn Kệ, yêu cầu đóng gói / trừ Kho sẽ xuất hiện tại đây để Thủ kho xác nhận.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchValue.trim() || activeTab !== 'waiting' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchValue('')
                            selectTab('waiting')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                          Về mục chờ đóng gói
                        </button>
                      ) : null}
                      {canOpenOrders ? (
                        <Link
                          to="/orders"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          Xem đơn hàng
                        </Link>
                      ) : null}
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
                      >
                        <span className="material-symbols-outlined text-[18px]">warehouse</span>
                        Kiểm tra tồn Kho
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? queues.map((row) => (
                    <tr key={row.queueId} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">
                        {canOpenOrders ? (
                          <Link className="hover:text-[#538463] hover:underline" to={`/orders/${row.orderId}`}>
                            {row.orderCode}
                          </Link>
                        ) : (
                          <span>{row.orderCode}</span>
                        )}
                        {row.lines?.length ? (
                          <div className="mt-2 space-y-1 text-xs font-medium text-slate-500">
                            {row.lines.slice(0, 2).map((line) => (
                              <p key={line.skuId}>
                                {line.skuCode || line.skuName}: bán {line.orderedQuantity}, đã trừ{' '}
                                {line.finishedDeductedQuantity}, chờ BOM {line.pendingBomQuantity}
                              </p>
                            ))}
                            {row.lines.length > 2 ? <p>+{row.lines.length - 2} dòng khác</p> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {getQueueStatusLabel(row.queueStatus)}
                        </span>
                        {row.isReserved ? (
                          <span
                            className="mt-1 block w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700"
                            title="Đơn COD đang giữ chỗ tồn Kệ Hàng — tồn khả bán đã trừ phần giữ chỗ này"
                          >
                            Đang giữ chỗ tồn
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(row.orderStockStatus)}`}
                        >
                          {getStockStatusLabel(row.orderStockStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(row.orderPaymentStatus)}`}
                        >
                          {getOrderStatusLabel(row.orderPaymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-600">
                        {formatVietnamDateTime(row.createdAt)}
                      </td>
                      <td className="px-8 py-5 text-right font-bold text-slate-800">
                        {formatVnd(row.totalAmount)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewQueue(row)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                            canExecuteDeduct
                              ? 'bg-[#538463] hover:bg-[#457053]'
                              : 'bg-slate-500 hover:bg-slate-600'
                          }`}
                        >
                          {canExecuteDeduct ? 'Xem & xác nhận' : canCancelQueue ? 'Xem & xử lý ngoại lệ' : 'Xem'}
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="yêu cầu đóng gói"
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      </section>

      {previewQueue ? (
        <StockDeductPreviewModal
          queueId={previewQueue.queueId}
          orderCode={previewQueue.orderCode}
          canConfirm={canExecuteDeduct}
          canCancel={canCancelQueue}
          onClose={() => setPreviewQueue(null)}
          onConfirmed={loadData}
        />
      ) : null}
    </PageShell>
  )
}

export default StockDeductQueuePage
