import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { Card, DataTable } from '../reportUi.jsx'

function SalesTab({ report, mode }) {
  const orders = report.orders || []

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
          subtitle={`${orders.length} đơn trong kỳ`}
          icon="list_alt"
        >
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
              <tr key={o.orderId}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                  {o.orderCode}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(o.createdAt)}</td>
                <td className="px-3 py-2">{o.customerName || 'Khách lẻ'}</td>
                <td className="px-3 py-2">{o.employeeName || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{o.channelLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{o.salesModeLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{o.orderStatus}</td>
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
          />
        </Card>
      )}
    </div>
  )
}

export default SalesTab
