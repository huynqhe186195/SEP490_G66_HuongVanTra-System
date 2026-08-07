import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { getOrderStatusLabel, getOrderStatusClass } from '../../../orders/utils/orderDisplay.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { Card, DataTable, Pagination } from '../reportUi.jsx'
import OrderDetailDrawer from '../OrderDetailDrawer.jsx'

const PAGE_SIZE = 50

function SalesTab({ report, mode, params }) {
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [pageItems, setPageItems] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPage(1)
    setPageItems(null)
  }, [params])

  // Trang đầu dùng lại lát dữ liệu trang cha đã tải, chỉ lật trang mới gọi thêm API.
  useEffect(() => {
    if (page === 1) return
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getSales({ ...params, page, pageSize: PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setPageItems(res?.items || [])
      })
      .catch((err) => {
        if (signal.aborted || err.name === 'AbortError') return
        setError(err.statusCode === 403 ? 'Bạn không có quyền xem danh sách đơn hàng.' : err.message)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [params, page])

  const totalCount = report.ordersTotalCount || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const orders = page === 1 ? (report.orders || []).slice(0, PAGE_SIZE) : pageItems || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Theo nhân viên bán hàng" icon="badge">
          <DataTable
            columns={[
              { key: 'name', label: 'Nhân viên' },
              { key: 'orders', label: 'Số đơn', align: 'center' },
              { key: 'discount', label: 'Giảm giá', align: 'right' },
              { key: 'revenue', label: 'Doanh thu', align: 'right' },
            ]}
            rows={report.byEmployee || []}
            renderRow={(e) => (
              <tr key={e.employeeId || e.employeeName}>
                <td className="px-3 py-2 font-medium text-[#1b1c17]">{e.employeeName}</td>
                <td className="px-3 py-2 text-center">{e.orderCount}</td>
                <td className="px-3 py-2 text-right">{formatVnd(e.discount)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatVnd(e.revenue)}</td>
              </tr>
            )}
          />
        </Card>

        <Card title="Theo kênh bán" icon="storefront">
          <DataTable
            columns={[
              { key: 'label', label: 'Kênh' },
              { key: 'orders', label: 'Số đơn', align: 'center' },
              { key: 'revenue', label: 'Doanh thu', align: 'right' },
            ]}
            rows={report.byChannel || []}
            renderRow={(c) => (
              <tr key={c.channel}>
                <td className="px-3 py-2 font-medium text-[#1b1c17]">{c.label}</td>
                <td className="px-3 py-2 text-center">{c.orderCount}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatVnd(c.revenue)}</td>
              </tr>
            )}
          />
        </Card>
      </div>

      <Card title="Theo phương thức bán hàng" icon="local_shipping">
        <DataTable
          columns={[
            { key: 'label', label: 'Phương thức' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'lines', label: 'Số dòng hàng', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={report.bySalesMode || []}
          renderRow={(s) => (
            <tr key={s.salesMode}>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{s.label}</td>
              <td className="px-3 py-2 text-center">{s.orderCount}</td>
              <td className="px-3 py-2 text-center">{s.quantity}</td>
              <td className="px-3 py-2 text-right font-semibold">{formatVnd(s.revenue)}</td>
            </tr>
          )}
        />
      </Card>

      {mode === 'detail' && (
        <Card
          title="Chi tiết từng đơn"
          subtitle={`${totalCount} đơn trong kỳ · bấm vào dòng để xem chi tiết đơn`}
          icon="list_alt"
        >
          {error && (
            <p className="mb-2 rounded-lg border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">
              {error}
            </p>
          )}
          <DataTable
            columns={[
              { key: 'code', label: 'Mã đơn' },
              { key: 'time', label: 'Thời gian' },
              { key: 'customer', label: 'Khách hàng' },
              { key: 'employee', label: 'Nhân viên' },
              { key: 'channel', label: 'Kênh' },
              { key: 'mode', label: 'PT bán' },
              { key: 'status', label: 'Trạng thái' },
              { key: 'lines', label: 'Dòng hàng', align: 'center' },
              { key: 'total', label: 'Tạm tính', align: 'right' },
              { key: 'discount', label: 'Giảm giá', align: 'right' },
              { key: 'final', label: 'Thành tiền', align: 'right' },
              { key: 'paid', label: 'Đã thu', align: 'right' },
              { key: 'methods', label: 'PT thanh toán' },
            ]}
            rows={orders}
            renderRow={(o) => (
              <tr key={o.orderId} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-[#f6f4ec]">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                  {o.orderCode}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(o.createdAt)}</td>
                <td className="px-3 py-2">{o.customerName || 'Khách lẻ'}</td>
                <td className="px-3 py-2">{o.employeeName || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{o.channelLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{o.salesModeLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${getOrderStatusClass(o.orderStatus)}`}>
                    {getOrderStatusLabel(o.orderStatus)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">{o.lineCount}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.totalAmount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.discountAmount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(o.finalAmount)}</td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right ${
                    o.paidAmount < o.finalAmount ? 'font-semibold text-[#b42318]' : ''
                  }`}
                >
                  {formatVnd(o.paidAmount)}
                </td>
                <td className="px-3 py-2 text-xs">{o.paymentMethods || '—'}</td>
              </tr>
            )}
            footer={
              totalCount > 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-2">
                    Tổng toàn kỳ ({totalCount} đơn)
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatVnd(report.ordersTotalDiscountAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[#356647]">
                    {formatVnd(report.ordersTotalFinalAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatVnd(report.ordersTotalPaidAmount)}
                  </td>
                  <td />
                </tr>
              ) : null
            }
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            unitLabel="đơn"
            isLoading={isLoading}
            onChange={setPage}
          />
        </Card>
      )}

      {selected && (
        <OrderDetailDrawer
          orderId={selected.orderId}
          orderCode={selected.orderCode}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

export default SalesTab
