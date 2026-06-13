import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchOrders, fetchReturns } from '../services/ordersApi.js'
import {
  formatVnd,
  resolveInventorySyncMeta,
  getOrderStatusClass,
  getOrderStatusLabel,
  ORDER_STATUS_OPTIONS,
  EXCHANGE_CHANNEL_FILTER_OPTIONS,
  getExchangeChannelBadgeClass,
  getExchangeChannelShortLabel,
} from '../utils/orderDisplay.js'

const VIEW_TABS = [
  { key: 'exchange', label: 'Đơn đổi' },
  { key: 'returns', label: 'Phiếu trả hàng' },
]

function ExchangeOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewTab = searchParams.get('tab') === 'exchange' ? 'exchange' : 'returns'

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState(() => searchParams.get('channel') || '')
  const [returnChannel, setReturnChannel] = useState(() => searchParams.get('channel') || '')
  const [orders, setOrders] = useState([])
  const [returns, setReturns] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      orderKind: 'Exchange',
      channel: channel || undefined,
      page,
      pageSize: TABLE_PAGE_SIZE,
    }),
    [search, status, channel, page],
  )

  const returnQueryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      channel: returnChannel || undefined,
      page,
      pageSize: TABLE_PAGE_SIZE,
    }),
    [search, returnChannel, page],
  )

  const hasActiveFilters =
    viewTab === 'exchange' ? Boolean(status || channel) : Boolean(returnChannel)

  function switchViewTab(nextTab) {
    setPage(1)
    if (nextTab === 'returns') {
      setSearchParams({ tab: 'returns' })
      return
    }
    setSearchParams({})
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const urlChannel = searchParams.get('channel') || ''
    if (viewTab === 'exchange') {
      setChannel(urlChannel)
    } else {
      setReturnChannel(urlChannel)
    }
  }, [searchParams, viewTab])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        if (viewTab === 'returns') {
          const data = await fetchReturns(returnQueryParams)
          if (mounted) {
            setReturns(data.items)
            setTotalCount(data.totalCount)
          }
          return
        }

        const data = await fetchOrders(queryParams)
        if (mounted) {
          setOrders(data.items)
          setTotalCount(data.totalCount)
        }
      } catch (error) {
        if (mounted) {
          setOrders([])
          setReturns([])
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
  }, [queryParams, returnQueryParams, viewTab])

  return (
    <PageShell className="pb-8">
      <PageHeader
        title="Trả / đổi hàng"
        description={
          viewTab === 'returns'
            ? 'Danh sách phiếu trả hàng — áp dụng chung cho mọi kênh bán.'
            : 'Đơn đổi phát sinh khi khách trả hàng và mua/đổi sản phẩm khác.'
        }
        searchPlaceholder={viewTab === 'returns' ? 'Tìm TH-..., HVT-..., tên khách...' : 'Tìm mã đơn, tên khách...'}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            ← Đơn bán hàng
          </Link>
        }
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {VIEW_TABS.map((tab) => {
            const active = viewTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchViewTab(tab.key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'bg-[#356647] text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {viewTab === 'exchange' ? (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Kênh đổi hàng</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-[#fbf9f1] p-1">
              {EXCHANGE_CHANNEL_FILTER_OPTIONS.map((opt) => {
                const active = channel === opt.value
                return (
                  <button
                    key={opt.value || 'all-channel'}
                    type="button"
                    onClick={() => {
                      setChannel(opt.value)
                      setPage(1)
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-white text-[#356647] shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="min-w-[180px] max-w-xs flex-1">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái</span>
            <select
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-3 text-sm outline-none focus:border-[#538463]"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all-status'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setStatus('')
                setChannel('')
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Hóa đơn gốc
              </span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-[#fbf9f1] p-1">
                {EXCHANGE_CHANNEL_FILTER_OPTIONS.map((opt) => {
                  const active = returnChannel === opt.value
                  return (
                    <button
                      key={`return-${opt.value || 'all'}`}
                      type="button"
                      onClick={() => {
                        setReturnChannel(opt.value)
                        setPage(1)
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? 'bg-white text-[#356647] shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setReturnChannel('')
                  setPage(1)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
        )}
      </section>

      {viewTab === 'returns' ? (
        <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã phiếu</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Hóa đơn gốc</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kênh</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách hàng</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Tiền trả</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Hoàn khách</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Đơn đổi</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ngày tạo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-10 text-slate-500" colSpan={9}>
                      Đang tải...
                    </td>
                  </tr>
                ) : null}
                {!isLoading && returns.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-slate-500" colSpan={9}>
                      {hasActiveFilters ? 'Không có phiếu trả phù hợp bộ lọc.' : 'Chưa có phiếu trả hàng.'}
                    </td>
                  </tr>
                ) : null}
                {!isLoading
                  ? returns.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                        <td className="px-6 py-4 font-bold text-slate-700">
                          <Link
                            className="hover:text-[#538463] hover:underline"
                            to={`/orders/returns/${item.id}`}
                          >
                            {item.returnCode}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="font-mono text-sm text-slate-700 hover:underline"
                            to={`/orders/${item.sourceOrderId}${item.sourceOrderChannel === 'COD' ? '?from=cod' : ''}`}
                          >
                            {item.sourceOrderCode}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getExchangeChannelBadgeClass(item.sourceOrderChannel)}`}
                          >
                            {getExchangeChannelShortLabel(item.sourceOrderChannel)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <OrderCustomerCell
                            snapshot={item.customerSnapshotName}
                            customerId={item.customerId}
                          />
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#356647]">{formatVnd(item.returnAmount)}</td>
                        <td className="px-4 py-4">
                          {item.refundAmount > 0 ? formatVnd(item.refundAmount) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          {item.exchangeOrderCode ? (
                            <Link
                              className="font-mono text-sm text-slate-700 hover:underline"
                              to={`/orders/${item.exchangeOrderId}?from=exchange`}
                            >
                              {item.exchangeOrderCode}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{formatVietnamDateTime(item.createdAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            className="text-sm font-semibold text-[#538463] hover:underline"
                            to={`/orders/returns/${item.id}`}
                          >
                            Chi tiết
                          </Link>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} totalCount={totalCount} itemLabel="phiếu trả" onPageChange={setPage} />
        </section>
      ) : null}

      {viewTab === 'exchange' ? (
      <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã đơn đổi</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kênh</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ghi chú</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Kho</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Ngày tạo</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#717971]">Thành tiền</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
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
                    {hasActiveFilters ? 'Không có đơn đổi phù hợp bộ lọc.' : 'Chưa có đơn đổi hàng.'}
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? orders.map((order) => {
                    const inventorySyncMeta = resolveInventorySyncMeta(order)
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                        <td className="px-6 py-4 font-bold text-slate-700">
                          <Link
                            className="hover:text-[#538463] hover:underline"
                            to={`/orders/${order.id}?from=exchange`}
                          >
                            {order.orderCode}
                          </Link>
                          <span className="ml-2 rounded-full bg-[#538463]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#356647]">
                            Đổi
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <OrderCustomerCell
                            snapshot={order.customerSnapshotName}
                            customerId={order.customerId}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getExchangeChannelBadgeClass(order.orderChannel)}`}
                          >
                            {getExchangeChannelShortLabel(order.orderChannel)}
                          </span>
                        </td>
                        <td className="max-w-[240px] px-4 py-4 text-xs text-slate-600">
                          {order.note?.trim() ? (
                            <span className="line-clamp-2" title={order.note}>
                              {order.note}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                            {getOrderStatusLabel(order.orderStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventorySyncMeta.className}`}>
                            {inventorySyncMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{formatVietnamDateTime(order.createdAt)}</td>
                        <td className="px-6 py-4 text-right font-bold text-[#356647]">{formatVnd(order.finalAmount)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            className="text-sm font-semibold text-[#538463] hover:underline"
                            to={`/orders/${order.id}?from=exchange`}
                          >
                            Chi tiết
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>

        <TablePagination page={page} totalCount={totalCount} itemLabel="đơn đổi" onPageChange={setPage} />
      </section>
      ) : null}
    </PageShell>
  )
}

export default ExchangeOrdersPage
