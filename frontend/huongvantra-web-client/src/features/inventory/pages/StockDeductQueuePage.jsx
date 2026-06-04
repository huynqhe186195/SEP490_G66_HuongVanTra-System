import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
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
  { key: 'all', label: 'Tất cả chờ xử lý', status: undefined },
  { key: 'waiting', label: 'Chờ trừ kho', status: 'waiting' },
  { key: 'insufficient', label: 'Chờ hàng', status: 'insufficient' },
]

function StockDeductQueuePage() {
  const canExecuteDeduct = canConfirmStockDeduct(loadAuthSession())
  const [activeTab, setActiveTab] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [queues, setQueues] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewQueue, setPreviewQueue] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = TABS.find((t) => t.key === activeTab)
      const items = await fetchPendingStockDeductQueues({
        status: tab?.status,
        search: searchValue.trim() || undefined,
      })
      setQueues(items)
    } catch (error) {
      setQueues([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const stats = useMemo(() => {
    const waiting = queues.filter((q) => q.queueStatus === 'waiting').length
    const insufficient = queues.filter((q) => q.queueStatus === 'insufficient').length
    return [
      { label: 'Chờ trừ kho', value: String(waiting), note: 'Queue waiting' },
      {
        label: 'Chờ hàng',
        value: String(insufficient),
        note: 'Thiếu NVL — cần nhập kho',
        warning: insufficient > 0,
      },
      { label: 'Tổng hiển thị', value: String(queues.length), note: 'Theo bộ lọc hiện tại' },
    ]
  }, [queues])

  return (
    <PageShell>
      <PageHeader
        title="Chờ trừ kho"
        description={
          canExecuteDeduct
            ? 'Xử lý đơn đã thu tiền nhưng chưa trừ kho hoặc đang thiếu nguyên liệu'
            : 'Theo dõi đơn chờ trừ kho — thao tác trừ kho do Thủ kho thực hiện'
        }
        searchPlaceholder="Tìm mã đơn..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
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
            {TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Queue</th>
                <th className="px-4 py-4">Trừ kho</th>
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
                    Không có đơn chờ trừ kho trong mục này.
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
                      </td>
                      <td className="px-4 py-5">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {getQueueStatusLabel(row.queueStatus)}
                        </span>
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
                          {canExecuteDeduct ? 'Xem & trừ' : 'Xem'}
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
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
