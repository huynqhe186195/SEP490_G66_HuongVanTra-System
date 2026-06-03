import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  confirmCodCompleted,
  fetchOrders,
  fetchOverdueCodOrders,
  markCodReminded,
  rejectCodOrder,
} from '../services/ordersApi.js'
import {
  formatVnd,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
} from '../utils/orderDisplay.js'

const TABS = [
  { key: 'pending', label: 'Chờ giao / chưa thu' },
  { key: 'overdue', label: 'Đơn treo (>7 ngày)' },
  { key: 'done', label: 'Đã hoàn tất' },
]

function CodOrdersPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [searchValue, setSearchValue] = useState('')
  const [pendingOrders, setPendingOrders] = useState([])
  const [doneOrders, setDoneOrders] = useState([])
  const [overdueOrders, setOverdueOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionOrderId, setActionOrderId] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pendingResult, doneResult, overdue] = await Promise.all([
        fetchOrders({
          paymentMethod: 'COD',
          paymentStatus: 'unpaid',
          search: searchValue.trim() || undefined,
          pageSize: 50,
        }),
        fetchOrders({
          paymentMethod: 'COD',
          paymentStatus: 'paid',
          search: searchValue.trim() || undefined,
          pageSize: 30,
        }),
        fetchOverdueCodOrders(),
      ])
      setPendingOrders(pendingResult.items)
      setDoneOrders(doneResult.items)
      setOverdueOrders(overdue)
    } catch (error) {
      setPendingOrders([])
      setDoneOrders([])
      setOverdueOrders([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [searchValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const stats = useMemo(
    () => [
      { label: 'Chờ giao', value: String(pendingOrders.length), note: 'COD chưa thu tiền' },
      { label: 'Đơn treo', value: String(overdueOrders.length), note: 'Quá 7 ngày chưa xử lý', warning: overdueOrders.length > 0 },
      { label: 'Đã hoàn tất', value: String(doneOrders.length), note: 'COD đã thu' },
    ],
    [pendingOrders.length, overdueOrders.length, doneOrders.length],
  )

  const runAction = async (orderId, action) => {
    setActionOrderId(orderId)
    try {
      if (action === 'confirm') {
        await confirmCodCompleted(orderId)
        showSuccess('Đã xác nhận giao hàng và thu tiền.')
      } else if (action === 'remind') {
        await markCodReminded(orderId)
        showSuccess('Đã đánh dấu đã nhắc khách.')
      } else if (action === 'reject') {
        const reason = window.prompt('Lý do khách từ chối nhận (tuỳ chọn):') ?? ''
        if (reason === null) return
        await rejectCodOrder(orderId, reason)
        showSuccess('Đã hủy đơn COD.')
      }
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setActionOrderId(null)
    }
  }

  const rows =
    activeTab === 'overdue'
      ? overdueOrders.map((row) => ({
          id: row.orderId,
          orderCode: row.orderCode,
          customerName: '—',
          customerPhone: '',
          totalAmount: row.totalAmount,
          orderStatus: row.orderStatus,
          paymentStatus: row.paymentStatus,
          createdAt: row.createdAt,
          extra: `${row.daysPending} ngày treo`,
          isOverdue: true,
        }))
      : activeTab === 'done'
        ? doneOrders
        : pendingOrders

  return (
    <PageShell>
      <PageHeader
        title="Đơn COD"
        description="Theo dõi giao hàng thu tiền mặt, đơn treo và xác nhận hoàn tất"
        searchPlaceholder="Tìm mã đơn, SĐT khách..."
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
            {tab.key === 'overdue' && overdueOrders.length > 0 ? (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-amber-950">
                {overdueOrders.length}
              </span>
            ) : null}
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

      <section className="min-h-[400px] overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            {TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Khách hàng</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Ngày tạo</th>
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
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={7}>
                    Không có đơn COD trong mục này.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? rows.map((order) => {
                    const busy = actionOrderId === order.id
                    const showActions = activeTab !== 'done'
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                        <td className="px-8 py-5 font-bold text-slate-700">
                          <Link className="hover:text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                            {order.orderCode}
                          </Link>
                          {order.extra ? (
                            <span className="mt-1 block text-xs font-normal text-amber-700">{order.extra}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-5">
                          <p className="font-medium text-slate-800">{order.customerName}</p>
                          {order.customerPhone ? (
                            <p className="text-xs text-slate-500">{order.customerPhone}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}
                          >
                            {getOrderStatusLabel(order.orderStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(order.paymentStatus)}`}
                          >
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatVietnamDateTime(order.createdAt)}
                        </td>
                        <td className="px-8 py-5 text-right font-bold text-slate-800">
                          {formatVnd(order.totalAmount)}
                        </td>
                        <td className="px-4 py-5">
                          {showActions ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => runAction(order.id, 'confirm')}
                                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                              >
                                Đã giao &amp; thu
                              </button>
                              {activeTab === 'overdue' || order.isOverdue ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(order.id, 'remind')}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  Đã nhắc
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => runAction(order.id, 'reject')}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Khách từ chối
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}

export default CodOrdersPage
