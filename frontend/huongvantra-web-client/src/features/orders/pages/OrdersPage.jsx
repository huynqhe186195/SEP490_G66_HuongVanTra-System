import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import SearchableSelect from '../../../components/shared/SearchableSelect.jsx'
import { canAccessModule, canViewStockDeductOps } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchOrderAccess, fetchOrderCreators, fetchOrders } from '../services/ordersApi.js'
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
  cashierId: '',
  datePreset: 'all',
}

function OrdersPage() {
  const authSession = loadAuthSession()
  const canManageCod = canAccessModule(authSession, 'cod_ops')
  const canManageStockDeduct = canViewStockDeductOps(authSession)
  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [orderCreators, setOrderCreators] = useState([])
  const [orderAccess, setOrderAccess] = useState({ canEdit: true, mode: 'All' })
  const showCreatorFilter = orderAccess.mode !== 'Own'

  const queryParams = useMemo(() => {
    const params = {
      search: filters.search.trim() || undefined,
      orderStatus: filters.orderStatus || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      cashierId: filters.cashierId ? Number(filters.cashierId) : undefined,
      page,
      pageSize: TABLE_PAGE_SIZE,
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

    const loadMeta = async () => {
      try {
        const [creators, access] = await Promise.all([fetchOrderCreators(), fetchOrderAccess()])
        if (mounted) {
          setOrderCreators(creators)
          setOrderAccess(access)
        }
      } catch {
        if (mounted) {
          setOrderCreators([])
          setOrderAccess({ canEdit: true, mode: 'All' })
        }
      }
    }

    loadMeta()
    return () => {
      mounted = false
    }
  }, [])

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

  const hasActiveFilters =
    filters.orderStatus ||
    filters.paymentStatus ||
    filters.paymentMethod ||
    filters.cashierId ||
    filters.datePreset !== 'all' ||
    filters.search

  const resetFilters = () => {
    setSearchInput('')
    setFilters(initialFilters)
    setPage(1)
  }

  return (
    <PageShell>
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

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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

          {showCreatorFilter ? (
            <SearchableSelect
              className="min-w-[200px] flex-1"
              label="Người tạo đơn"
              placeholder="Gõ tên nhân viên..."
              emptyLabel="Tất cả nhân viên"
              value={filters.cashierId}
              options={orderCreators}
              getOptionValue={(creator) => String(creator.id)}
              getOptionLabel={(creator) => creator.fullName}
              onChange={(cashierId) => {
                setFilters((prev) => ({ ...prev, cashierId }))
                setPage(1)
              }}
            />
          ) : null}

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

          {canManageCod ? (
            <Link
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100"
              to="/orders/cod"
            >
              Quản lý COD
            </Link>
          ) : null}
          {canManageStockDeduct ? (
            <Link
              className={`inline-flex items-center gap-2 rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/10 ${canManageCod ? '' : 'ml-auto'}`}
              to="/orders/stock-deduct"
            >
              Chờ trừ kho
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 p-4 sm:p-6">
          <h2 className="text-xl font-bold text-slate-800">
            Danh sách đơn hàng
            <span className="ml-2 text-sm font-normal text-slate-500">({totalCount} đơn)</span>
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-[#f6f4ec] text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Mã đơn</th>
                <th className="px-4 py-4">Khách hàng</th>
                <th className="px-4 py-4">Kênh</th>
                <th className="px-4 py-4">Người tạo đơn</th>
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
                  <td className="px-6 py-10 text-slate-500" colSpan={9}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={9}>
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
                      <td className="px-4 py-4 text-sm font-medium text-slate-700">
                        {order.cashierName || '—'}
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

        <TablePagination page={page} totalCount={totalCount} itemLabel="đơn" onPageChange={setPage} />
      </section>
    </PageShell>
  )
}

export default OrdersPage
