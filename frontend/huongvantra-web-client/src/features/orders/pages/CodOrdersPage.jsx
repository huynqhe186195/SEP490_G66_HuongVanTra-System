import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateOrder } from '../../auth/utils/permissions.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  fetchOrders,
  fetchOverdueCodPayments,
  fetchUnverifiedCodPayments,
  verifyCodPayment,
} from '../services/ordersApi.js'
import {
  formatVnd,
  getCodDaysPending,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  isCodOverdue,
} from '../utils/orderDisplay.js'

const TABS = [
  { key: 'pending', label: 'Chờ thu COD' },
  { key: 'overdue', label: 'Quá hạn (>7 ngày)' },
  { key: 'done', label: 'Đã hoàn tất' },
]

function CodOrdersPage() {
  const canManage = canCreateOrder(loadAuthSession())
  const [activeTab, setActiveTab] = useState('pending')
  const [searchValue, setSearchValue] = useState('')
  const [pendingPayments, setPendingPayments] = useState([])
  const [overduePayments, setOverduePayments] = useState([])
  const [doneOrders, setDoneOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionPaymentId, setActionPaymentId] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pending, overdue, completed] = await Promise.all([
        fetchUnverifiedCodPayments(),
        fetchOverdueCodPayments(),
        fetchOrders({ status: 'Completed', pageSize: 50 }),
      ])
      setPendingPayments(pending)
      setOverduePayments(overdue)
      setDoneOrders(completed.items.filter((order) => order.orderChannel !== 'POS'))
    } catch (error) {
      setPendingPayments([])
      setOverduePayments([])
      setDoneOrders([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = useMemo(
    () => [
      { label: 'Chờ thu COD', value: String(pendingPayments.length), note: 'Chưa xác nhận thu tiền' },
      {
        label: 'Quá hạn',
        value: String(overduePayments.length),
        note: 'Quá 7 ngày chưa xử lý',
        warning: overduePayments.length > 0,
      },
      { label: 'Hoàn tất gần đây', value: String(doneOrders.length), note: 'Đơn Completed' },
    ],
    [pendingPayments.length, overduePayments.length, doneOrders.length],
  )

  const filteredPending = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return pendingPayments
    return pendingPayments.filter(
      (row) =>
        row.orderCode?.toLowerCase().includes(term) ||
        row.customerSnapshotName?.toLowerCase().includes(term),
    )
  }, [pendingPayments, searchValue])

  const filteredOverdue = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return overduePayments
    return overduePayments.filter(
      (row) =>
        row.orderCode?.toLowerCase().includes(term) ||
        row.customerSnapshotName?.toLowerCase().includes(term),
    )
  }, [overduePayments, searchValue])

  async function handleVerify(payment) {
    if (!canManage) return
    const transactionRef = window.prompt('Mã tham chiếu giao dịch (tuỳ chọn):') ?? ''
    if (transactionRef === null) return
    setActionPaymentId(payment.id)
    try {
      await verifyCodPayment(payment.id, transactionRef)
      showSuccess(`Đã xác nhận thu COD cho đơn ${payment.orderCode}.`)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setActionPaymentId(null)
    }
  }

  function renderPaymentRows(rows, showActions = true) {
    if (!rows.length) {
      return (
        <tr>
          <td className="px-8 py-10 text-slate-500" colSpan={7}>
            Không có dữ liệu trong mục này.
          </td>
        </tr>
      )
    }

    return rows.map((payment) => {
      const busy = actionPaymentId === payment.id
      const overdue = isCodOverdue(payment)
      return (
        <tr key={payment.id} className="transition-colors hover:bg-[#fbf9f1]/30">
          <td className="px-8 py-5 font-bold text-slate-700">
            <Link className="hover:text-[#538463] hover:underline" to={`/orders/${payment.orderId}`}>
              {payment.orderCode || '—'}
            </Link>
            {overdue ? (
              <span className="mt-1 block text-xs font-normal text-amber-700">
                Quá hạn · {getCodDaysPending(payment)} ngày
              </span>
            ) : null}
          </td>
          <td className="px-4 py-5 font-medium text-slate-800">{payment.customerSnapshotName || 'Khách lẻ'}</td>
          <td className="px-4 py-5">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(payment.paymentStatus)}`}>
              {getPaymentStatusLabel(payment.paymentStatus)}
            </span>
          </td>
          <td className="px-4 py-5 text-sm text-slate-600">
            {payment.codWarningDate ? formatVietnamDateTime(payment.codWarningDate) : '—'}
          </td>
          <td className="px-8 py-5 text-right font-bold text-slate-800">{formatVnd(payment.amount)}</td>
          <td className="px-4 py-5 text-right">
            {showActions && canManage ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleVerify(payment)}
                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                Đã giao &amp; thu
              </button>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>
        </tr>
      )
    })
  }

  const rows =
    activeTab === 'overdue'
      ? filteredOverdue
      : activeTab === 'done'
        ? doneOrders.map((order) => ({
            id: order.id,
            orderId: order.id,
            orderCode: order.orderCode,
            customerSnapshotName: order.customerSnapshotName,
            paymentStatus: 'Success',
            amount: order.finalAmount,
            codWarningDate: null,
          }))
        : filteredPending

  return (
    <PageShell>
      <PageHeader
        title="Đơn COD"
        description="Theo dõi và xác nhận thu tiền COD qua OrderService."
        searchPlaceholder="Tìm mã đơn, tên khách..."
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
            {tab.key === 'overdue' && overduePayments.length > 0 ? (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-amber-950">
                {overduePayments.length}
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
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Hạn cảnh báo</th>
                <th className="px-8 py-4 text-right">Số tiền</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={6}>
                    Đang tải...
                  </td>
                </tr>
              ) : activeTab === 'done' ? (
                doneOrders.length === 0 ? (
                  <tr>
                    <td className="px-8 py-10 text-slate-500" colSpan={6}>
                      Không có đơn hoàn tất gần đây.
                    </td>
                  </tr>
                ) : (
                  doneOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">
                        <Link className="hover:text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                          {order.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-5">{order.customerSnapshotName || 'Khách lẻ'}</td>
                      <td className="px-4 py-5">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Hoàn tất
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-500">{formatVietnamDateTime(order.createdAt)}</td>
                      <td className="px-8 py-5 text-right font-bold">{formatVnd(order.finalAmount)}</td>
                      <td className="px-4 py-5 text-right text-xs text-slate-400">—</td>
                    </tr>
                  ))
                )
              ) : (
                renderPaymentRows(rows, activeTab !== 'done')
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}

export default CodOrdersPage
