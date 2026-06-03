import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchOrders } from '../services/ordersApi.js'
import {
  formatVnd,
  getOrderChannelLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../utils/orderDisplay.js'

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function getTodayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const initialFilters = {
  search: '',
  orderStatus: '',
  paymentStatus: '',
  paymentMethod: '',
  datePreset: 'all',
}

function OrdersPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const pageSize = 20

  const queryParams = useMemo(() => {
    const params = {
      search: filters.search.trim() || undefined,
      orderStatus: filters.orderStatus || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      page,
      pageSize,
    }
    if (filters.datePreset === 'today') {
      const today = getTodayIsoDate()
      params.fromDate = today
      params.toDate = today
    }
    return params
  }, [filters, page])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }))
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let mounted = true

    const load = async () => {
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasActiveFilters =
    filters.orderStatus ||
    filters.paymentStatus ||
    filters.paymentMethod ||
    filters.datePreset !== 'all' ||
    filters.search

  const resetFilters = () => {
    setSearchInput('')
    setFilters(initialFilters)
    setPage(1)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fbf9f1] p-8">
      <PageHeader
        title="Đơn hàng"
        description="Xem và chỉnh sửa đơn tạo từ POS. Tạo đơn mới tại màn hình POS bán hàng."
        searchPlaceholder="Tìm mã đơn, SĐT, mã khách..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#457053]"
            to="/pos"
          >
            Mở POS
          </Link>
        }
      />

      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái đơn</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
              value={filters.orderStatus}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, orderStatus: e.target.value }))
                setPage(1)
              }}
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Thanh toán</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
              value={filters.paymentStatus}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))
                setPage(1)
              }}
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-pay'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Phương thức</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
              value={filters.paymentMethod}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))
                setPage(1)
              }}
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-method'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Ngày tạo</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
              value={filters.datePreset}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, datePreset: e.target.value }))
                setPage(1)
              }}
            >
              <option value="all">Tất cả</option>
              <option value="today">Hôm nay</option>
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}

          <Link
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100"
            to="/orders/cod"
          >
            Đơn COD
          </Link>
        </div>
      </section>

      <section className="min-h-[400px] overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            Danh sách đơn hàng
            <span className="ml-2 text-sm font-normal text-slate-500">({totalCount} đơn)</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Mã đơn</th>
                <th className="px-4 py-4">Khách hàng</th>
                <th className="px-4 py-4">Kênh</th>
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Ngày tạo</th>
                <th className="px-6 py-4 text-right">Tổng tiền</th>
                <th className="px-4 py-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
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
                    Không có đơn phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? orders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-6 py-4 font-bold text-slate-700">
                        <Link className="hover:text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                          {order.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {getInitials(order.customerName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{order.customerName}</p>
                            {order.customerPhone ? (
                              <p className="text-xs text-slate-500">{order.customerPhone}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {getOrderChannelLabel(order.orderCode)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {getPaymentMethodLabel(order.paymentMethod)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}
                        >
                          {getOrderStatusLabel(order.orderStatus)}
                        </span>
                        <span
                          className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(order.paymentStatus)}`}
                        >
                          {getPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatVietnamDateTime(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">
                        {formatVnd(order.totalAmount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          className="text-sm font-semibold text-[#538463] hover:underline"
                          to={`/orders/${order.id}`}
                        >
                          Sửa
                        </Link>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-50 px-6 py-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-sm text-slate-600">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default OrdersPage
