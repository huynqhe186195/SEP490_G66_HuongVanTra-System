import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { canCancelStockDeduct, canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import StockDeductPreviewModal from '../components/StockDeductPreviewModal.jsx'
import { fetchPendingStockDeductQueues } from '../services/stockDeductQueueApi.js'
import {
  formatVnd,
  getPaymentStatusClass,
  getPaymentStatusLabel,
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

function StockDeductQueuePage() {
  const canExecuteDeduct = canConfirmStockDeduct(loadAuthSession())
  const canCancelQueue = canCancelStockDeduct(loadAuthSession())
  const [activeTab, setActiveTab] = useState('waiting')
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

  return (
    <PageShell>
      <PageHeader
        compact
        title="Chờ đóng gói / trừ Kho"
        titleInfo={
          canExecuteDeduct
            ? 'Thủ kho xác nhận đóng gói và trừ nguyên liệu Kho theo Queue.'
            : canCancelQueue
              ? 'Theo dõi Queue; Quản lý hoặc Admin chỉ hủy khi xử lý ngoại lệ.'
              : 'Theo dõi Queue đóng gói theo quyền được cấp.'
        }
        searchPlaceholder="Tìm mã đơn..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StatusFilterChips
          options={tabChipOptions}
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value)
            setPage(1)
          }}
        />
        <Link
          className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/orders"
        >
          Tất cả đơn hàng
        </Link>
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
                <th className="px-4 py-4">Queue</th>
                <th className="px-4 py-4">Tồn cần đối soát</th>
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Ngày tạo queue</th>
                <th className="px-8 py-4 text-right">Tổng tiền</th>
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
              ) : null}
              {!isLoading && queues.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={7}>
                    Không có Queue đóng gói trong mục này.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? queues.map((row) => (
                    <tr key={row.queueId} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">
                        <Link className="hover:text-[#538463] hover:underline" to={`/orders/${row.orderId}`}>
                          {row.orderCode}
                        </Link>
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
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(row.orderPaymentStatus)}`}
                        >
                          {getPaymentStatusLabel(row.orderPaymentStatus)}
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
          itemLabel="Queue đóng gói"
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
