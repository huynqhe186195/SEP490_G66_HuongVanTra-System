import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { canAccessModule } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewOnlyCodOrders } from '../../auth/utils/permissions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import {
  exportOrdersToExcel,
  exportReturnSlipsToExcel,
  fetchOrders,
  fetchReturns,
} from '../services/ordersApi.js'
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
  const session = loadAuthSession()
  const codOnly = canViewOnlyCodOrders(session)
  const canOpenGeneralOrders = canAccessModule(session, 'orders')
  const [searchParams, setSearchParams] = useSearchParams()
  const viewTab = searchParams.get('tab') === 'exchange' ? 'exchange' : 'returns'

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState(() => (codOnly ? 'COD' : (searchParams.get('channel') || '')))
  const [returnChannel, setReturnChannel] = useState(() => (codOnly ? 'COD' : (searchParams.get('channel') || '')))
  const [orders, setOrders] = useState([])
  const [returns, setReturns] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      orderKind: 'Exchange',
      channel: codOnly ? 'COD' : (channel || undefined),
      page,
      pageSize,
    }),
    [search, status, channel, page, pageSize, codOnly],
  )

  const returnQueryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      channel: codOnly ? 'COD' : (returnChannel || undefined),
      page,
      pageSize,
    }),
    [search, returnChannel, page, pageSize, codOnly],
  )

  const hasActiveFilters =
    viewTab === 'exchange' ? Boolean(status || channel) : Boolean(returnChannel)

  function switchViewTab(nextTab) {
    setPage(1)
    setSearchParams({ tab: nextTab })
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

  async function handleExport() {
    if (isExporting) return
    try {
      setIsExporting(true)
      if (viewTab === 'returns') {
        await exportReturnSlipsToExcel(
          {
            search: search.trim() || undefined,
            channel: codOnly ? 'COD' : (returnChannel || undefined),
          },
          codOnly ? 'Phieu_Tra_Hang_COD' : 'Phieu_Tra_Hang',
        )
        showSuccess('Đã tải file xuất phiếu trả hàng.')
        return
      }

      await exportOrdersToExcel(
        {
          search: search.trim() || undefined,
          status: status || undefined,
          orderKind: 'Exchange',
          channel: codOnly ? 'COD' : (channel || undefined),
        },
        codOnly ? 'Don_Doi_COD' : 'Don_Doi',
      )
      showSuccess('Đã tải file xuất đơn đổi.')
    } catch (error) {
      showError(error.message || 'Xuất file thất bại.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageShell className="gap-1.5 sm:gap-1.5">
      <PageHeader
        compact
        title="Trả / đổi hàng"
        titleInfo={
          viewTab === 'returns'
            ? codOnly
              ? 'Phiếu trả hàng của đơn COD.'
              : 'Danh sách phiếu trả hàng — áp dụng chung cho mọi kênh bán.'
            : codOnly
              ? 'Đơn đổi phát sinh từ đơn COD.'
              : 'Đơn đổi phát sinh khi khách trả hàng và mua/đổi sản phẩm khác.'
        }
        searchPlaceholder={viewTab === 'returns' ? 'Tìm TH-..., HVT-..., tên khách...' : 'Tìm mã đơn, tên khách...'}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={isExporting || isLoading}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
                ios_share
              </span>
              Export Excel
            </button>
            {canOpenGeneralOrders ? (
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                to="/orders"
              >
                ← Đơn bán hàng
              </Link>
            ) : (
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                to="/orders/cod"
              >
                ← Quản lý đơn COD
              </Link>
            )}
          </div>
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
          {!codOnly ? (
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
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Chỉ hiển thị trả/đổi từ đơn <strong>COD</strong>.
            </p>
          )}

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

          {hasActiveFilters && !codOnly ? (
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
            {!codOnly ? (
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
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Chỉ hiển thị phiếu trả từ đơn <strong>COD</strong>.
              </p>
            )}
            {hasActiveFilters && !codOnly ? (
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
          <div className="divide-y divide-slate-100 lg:hidden">
            {isLoading ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Đang tải...</p>
            ) : null}
            {!isLoading && returns.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {hasActiveFilters ? 'Không có phiếu trả phù hợp bộ lọc.' : 'Chưa có phiếu trả hàng.'}
              </p>
            ) : null}
            {!isLoading
              ? returns.map((item) => (
                  <article key={item.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          className="text-base font-bold text-slate-800 hover:text-[#538463] hover:underline"
                          to={`/orders/returns/${item.id}`}
                        >
                          {item.returnCode}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{formatVietnamDateTime(item.createdAt)}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getExchangeChannelBadgeClass(item.sourceOrderChannel)}`}
                      >
                        {getExchangeChannelShortLabel(item.sourceOrderChannel)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Hóa đơn gốc</dt>
                        <dd>
                          <Link
                            className="font-mono text-sm text-slate-700 hover:underline"
                            to={`/orders/${item.sourceOrderId}${item.sourceOrderChannel === 'COD' ? '?from=cod' : ''}`}
                          >
                            {item.sourceOrderCode}
                          </Link>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Khách hàng</dt>
                        <dd className="text-slate-700">
                          <OrderCustomerCell
                            snapshot={item.customerSnapshotName}
                            customerId={item.customerId}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Tiền trả</dt>
                        <dd className="font-semibold text-[#356647]">{formatVnd(item.returnAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Hoàn khách</dt>
                        <dd className="font-semibold text-slate-700">
                          {item.refundAmount > 0 ? formatVnd(item.refundAmount) : '—'}
                        </dd>
                      </div>
                    </dl>
                    {item.exchangeOrderCode ? (
                      <p className="text-xs text-slate-500">
                        Đơn đổi:{' '}
                        <Link
                          className="font-mono font-semibold text-slate-700 hover:underline"
                          to={`/orders/${item.exchangeOrderId}?from=exchange`}
                        >
                          {item.exchangeOrderCode}
                        </Link>
                      </p>
                    ) : null}
                    <Link
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/5"
                      to={`/orders/returns/${item.id}`}
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                ))
              : null}
          </div>

          <div className="hidden overflow-x-auto lg:block">
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
          <TablePagination
            page={page}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalCount={totalCount}
            itemLabel="phiếu trả"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </section>
      ) : null}

      {viewTab === 'exchange' ? (
      <section className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="divide-y divide-slate-100 lg:hidden">
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Đang tải...</p>
          ) : null}
          {!isLoading && orders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {hasActiveFilters ? 'Không có đơn đổi phù hợp bộ lọc.' : 'Chưa có đơn đổi hàng.'}
            </p>
          ) : null}
          {!isLoading
            ? orders.map((order) => {
                const inventorySyncMeta = resolveInventorySyncMeta(order)
                return (
                  <article key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          className="text-base font-bold text-slate-800 hover:text-[#538463] hover:underline"
                          to={`/orders/${order.id}?from=exchange`}
                        >
                          {order.orderCode}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{formatVietnamDateTime(order.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-[#538463]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#356647]">
                        Đổi
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                        {getOrderStatusLabel(order.orderStatus)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inventorySyncMeta.className}`}>
                        {inventorySyncMeta.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getExchangeChannelBadgeClass(order.orderChannel)}`}>
                        {getExchangeChannelShortLabel(order.orderChannel)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Khách hàng</dt>
                        <dd className="text-slate-700">
                          <OrderCustomerCell
                            snapshot={order.customerSnapshotName}
                            customerId={order.customerId}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Người bán</dt>
                        <dd className="text-slate-700">{order.sellerName?.trim() || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Thành tiền</dt>
                        <dd className="font-bold text-[#356647]">{formatVnd(order.finalAmount)}</dd>
                      </div>
                    </dl>
                    {order.note?.trim() ? (
                      <p className="line-clamp-2 text-xs text-slate-600">{order.note}</p>
                    ) : null}
                    <Link
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/5"
                      to={`/orders/${order.id}?from=exchange`}
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                )
              })
            : null}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Mã đơn đổi</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#717971]">Người bán</th>
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
                  <td className="px-6 py-10 text-slate-500" colSpan={10}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={10}>
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
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {order.sellerName?.trim() ? order.sellerName : <span className="text-slate-300">—</span>}
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

        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="đơn đổi"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>
      ) : null}
    </PageShell>
  )
}

export default ExchangeOrdersPage
