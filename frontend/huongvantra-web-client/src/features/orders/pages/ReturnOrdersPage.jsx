import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import { fetchReturns } from '../services/ordersApi.js'
import { formatVnd } from '../utils/orderDisplay.js'

function ReturnOrdersPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [returns, setReturns] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize: TABLE_PAGE_SIZE,
    }),
    [search, page],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        const data = await fetchReturns(queryParams)
        if (mounted) {
          setReturns(data.items)
          setTotalCount(data.totalCount)
        }
      } catch (error) {
        if (mounted) {
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
  }, [queryParams])

  return (
    <PageShell className="pb-8">
      <PageHeader
        title="Phiếu trả hàng"
        titleInfo="Danh sách phiếu trả từ POS — tra cứu theo mã phiếu, mã hóa đơn gốc hoặc tên khách."
        searchPlaceholder="Tìm TH-..., HVT-..., tên khách..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            to="/orders/exchange"
          >
            ← Trả / đổi hàng
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Hóa đơn gốc</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tiền trả</th>
                <th className="px-4 py-3">Hoàn khách</th>
                <th className="px-4 py-3">Đơn đổi</th>
                <th className="px-4 py-3">Lý do</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Chưa có phiếu trả hàng.
                  </td>
                </tr>
              ) : (
                returns.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f6f4ec]/60">
                    <td className="px-4 py-3">
                      <Link to={`/orders/returns/${item.id}`} className="font-semibold text-[#356647] hover:underline">
                        {item.returnCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/orders/${item.sourceOrderId}`} className="font-mono text-slate-700 hover:underline">
                        {item.sourceOrderCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <OrderCustomerCell snapshot={item.customerSnapshotName} customerId={item.customerId} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatVnd(item.returnAmount)}</td>
                    <td className="px-4 py-3">{item.refundAmount > 0 ? formatVnd(item.refundAmount) : '—'}</td>
                    <td className="px-4 py-3">
                      {item.exchangeOrderCode ? (
                        <Link
                          to={`/orders/${item.exchangeOrderId}?from=exchange`}
                          className="font-mono text-slate-700 hover:underline"
                        >
                          {item.exchangeOrderCode}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-xs text-slate-600">
                      {item.note?.trim() ? (
                        <span className="line-clamp-2" title={item.note}>
                          {item.note}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatVietnamDateTime(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalCount={totalCount}
          pageSize={TABLE_PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>
    </PageShell>
  )
}

export default ReturnOrdersPage
