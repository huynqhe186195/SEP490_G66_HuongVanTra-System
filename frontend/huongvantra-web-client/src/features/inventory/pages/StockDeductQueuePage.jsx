import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
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
  { key: 'all', label: 'Tất cả', status: undefined },
  { key: 'waiting', label: 'Chờ xác nhận', status: 'waiting' },
  { key: 'insufficient', label: 'Chờ hàng', status: 'insufficient' },
  { key: 'confirmed', label: 'Đã trừ', status: 'confirmed' },
  { key: 'cancelled', label: 'Đã hủy', status: 'cancelled' },
]

function getStockDeductTabLabel(tab) {
  if (tab?.key === 'waiting') return 'Chờ đối soát'
  if (tab?.key === 'insufficient') return 'Chờ nguyên liệu'
  return tab?.label ?? ''
}

function StockDeductQueuePage() {
  const canExecuteDeduct = canConfirmStockDeduct(loadAuthSession())
  const [activeTab, setActiveTab] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [queues, setQueues] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [previewQueue, setPreviewQueue] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = TABS.find((t) => t.key === activeTab)
      const items = await fetchPendingStockDeductQueues({
        status: tab?.status,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      setQueues(items.items)
      setTotalCount(items.totalCount)
    } catch (error) {
      setQueues([])
      setTotalCount(0)
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

  const stats = useMemo(() => {
    const waiting = queues.filter((q) => q.queueStatus === 'waiting').length
    const insufficient = queues.filter((q) => q.queueStatus === 'insufficient').length
    const confirmed = queues.filter((q) => q.queueStatus === 'confirmed').length
    const cancelled = queues.filter((q) => q.queueStatus === 'cancelled').length
    return [
      { label: 'Chờ xác nhận', value: String(waiting), note: 'Manager/Admin xử lý' },
      {
        label: 'Chờ hàng',
        value: String(insufficient),
        note: 'Thiếu Tồn quầy POS mặc định - có thể thử lại',
        warning: insufficient > 0,
      },
      { label: 'Đã trừ / Đã hủy', value: `${confirmed} / ${cancelled}`, note: 'Theo bộ lọc hiện tại' },
    ]
  }, [queues])

  return (
    <PageShell>
      <PageHeader
        title="Chờ trừ tồn quầy"
        titleInfo={
          canExecuteDeduct
            ? 'Manager/Admin xác nhận trừ QuantityOnHand của Tồn quầy POS mặc định cho đơn đã bán trước.'
            : 'Theo dõi đơn chờ trừ Tồn quầy POS mặc định.'
        }
        searchPlaceholder="Tìm mã đơn..."
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
            {getStockDeductTabLabel(tab)}
          </button>
        ))}
        <Link
          className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/orders"
        >
          Tất cả đơn hàng
        </Link>
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
          <h2 className="text-xl font-bold text-slate-800">
            {getStockDeductTabLabel(TABS.find((t) => t.key === activeTab))}
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Queue</th>
                <th className="px-4 py-4">Tồn quầy POS</th>
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
                    Không có đơn chờ trừ tồn quầy trong mục này.
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
                          {canExecuteDeduct ? 'Xem & xử lý' : 'Xem'}
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
          totalCount={totalCount}
          itemLabel="đơn chờ trừ tồn quầy"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>

      {previewQueue ? (
        <StockDeductPreviewModal
          queueId={previewQueue.queueId}
          orderCode={previewQueue.orderCode}
          readOnly={!canExecuteDeduct}
          onClose={() => setPreviewQueue(null)}
          onConfirmed={loadData}
        />
      ) : null}
    </PageShell>
  )
}

export default StockDeductQueuePage
