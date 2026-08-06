import { useMemo, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { getOrderStatusLabel, getOrderStatusClass } from '../../../orders/utils/orderDisplay.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../../utils/cashReportLabels.js'
import { Card, DataTable, EmptyState } from '../reportUi.jsx'
import OrderDetailDrawer from '../OrderDetailDrawer.jsx'

function Tile({ label, value, tone = 'neutral', hint }) {
  const toneClass =
    tone === 'danger' ? 'text-[#b42318]' : tone === 'warn' ? 'text-[#7e5700]' : 'text-[#1b1c17]'
  return (
    <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
      <p className="text-xs text-[#717971]">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#717971]">{hint}</p>}
    </div>
  )
}

/**
 * Tab Ngoại lệ gom các trường hợp cần người phụ trách xử lý trước khi chốt sổ:
 * đơn chưa thu đủ tiền, tiền thu trên đơn đã hủy, và các khoản thu lệch kỳ.
 */
function ExceptionsTab({ report, periodStartUtc }) {
  const [selected, setSelected] = useState(null)

  const orders = useMemo(() => report.orders || [], [report.orders])
  const receipts = useMemo(() => report.receipts || [], [report.receipts])
  const bridge = report.bridge || {}

  const underpaid = useMemo(
    () => orders.filter((o) => (o.paidAmount || 0) < (o.finalAmount || 0)),
    [orders],
  )

  const receiptsOnCancelled = useMemo(
    () => receipts.filter((r) => r.orderStatus === 'Cancelled'),
    [receipts],
  )

  const priorPeriodReceipts = useMemo(() => {
    if (!periodStartUtc) return []
    const start = new Date(periodStartUtc).getTime()
    return receipts.filter((r) => r.orderCreatedAt && new Date(r.orderCreatedAt).getTime() < start)
  }, [receipts, periodStartUtc])

  const underpaidAmount = underpaid.reduce((s, o) => s + ((o.finalAmount || 0) - (o.paidAmount || 0)), 0)

  const hasAnything =
    underpaid.length > 0 ||
    receiptsOnCancelled.length > 0 ||
    priorPeriodReceipts.length > 0 ||
    (report.cancelledOrders || 0) > 0 ||
    (report.refundedOrders || 0) > 0 ||
    (report.forfeitedDepositOrders || 0) > 0

  if (!hasAnything) {
    return (
      <EmptyState
        text="Không phát hiện ngoại lệ nào trong kỳ."
        hint="Mọi đơn trong kỳ đều đã thu đủ tiền, không có đơn hủy hay khoản thu bất thường."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Đơn chưa thu đủ tiền"
          value={underpaid.length}
          tone={underpaid.length ? 'danger' : 'neutral'}
          hint={underpaid.length ? `Còn thiếu ${formatVnd(underpaidAmount)}` : undefined}
        />
        <Tile label="Đơn đã hủy" value={report.cancelledOrders || 0} tone="warn" />
        <Tile label="Đơn có hoàn tiền" value={report.refundedOrders || 0} tone="warn" />
        <Tile
          label="Cọc bị giữ"
          value={formatVnd(report.forfeitedDepositIncome)}
          hint={`${report.forfeitedDepositOrders || 0} đơn hủy sau khi đã đặt cọc`}
        />
      </div>

      <Card
        title="Đơn chưa thu đủ tiền"
        subtitle="Ghi nợ, COD chưa đối soát hoặc còn phần thu khi nhận hàng. Bấm vào dòng để xem chi tiết đơn."
        icon="money_off"
      >
        <DataTable
          columns={[
            { key: 'code', label: 'Mã đơn' },
            { key: 'time', label: 'Thời gian' },
            { key: 'customer', label: 'Khách hàng' },
            { key: 'employee', label: 'Nhân viên' },
            { key: 'status', label: 'Trạng thái' },
            { key: 'final', label: 'Thành tiền', align: 'right' },
            { key: 'paid', label: 'Đã thu', align: 'right' },
            { key: 'missing', label: 'Còn thiếu', align: 'right' },
          ]}
          rows={underpaid}
          emptyText="Mọi đơn trong kỳ đều đã thu đủ tiền."
          renderRow={(o) => (
            <tr
              key={o.orderId}
              onClick={() => setSelected(o)}
              className="cursor-pointer hover:bg-[#f6f4ec]"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                {o.orderCode}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(o.createdAt)}</td>
              <td className="px-3 py-2">{o.customerName || 'Khách lẻ'}</td>
              <td className="px-3 py-2">{o.employeeName || '—'}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusClass(o.orderStatus)}`}>
                  {getOrderStatusLabel(o.orderStatus)}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.finalAmount)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.paidAmount)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-[#b42318]">
                {formatVnd((o.finalAmount || 0) - (o.paidAmount || 0))}
              </td>
            </tr>
          )}
          footer={
            underpaid.length > 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-2 text-right">
                  Tổng còn thiếu
                </td>
                <td className="px-3 py-2 text-right text-[#b42318]">{formatVnd(underpaidAmount)}</td>
              </tr>
            ) : null
          }
        />
      </Card>

      {receiptsOnCancelled.length > 0 && (
        <Card
          title="Khoản thu trên đơn đã hủy"
          subtitle="Tiền đã vào két nhưng đơn không còn hiệu lực — cần xác nhận hoàn tiền hoặc giữ cọc."
          icon="report"
        >
          <DataTable
            columns={[
              { key: 'code', label: 'Mã đơn' },
              { key: 'time', label: 'Thời gian thu' },
              { key: 'method', label: 'Phương thức' },
              { key: 'purpose', label: 'Mục đích' },
              { key: 'amount', label: 'Số tiền', align: 'right' },
            ]}
            rows={receiptsOnCancelled}
            renderRow={(r, i) => (
              <tr key={`${r.orderId}-${i}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                  {r.orderCode}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(r.paidAt)}</td>
                <td className="px-3 py-2">{paymentMethodLabel(r.paymentMethod)}</td>
                <td className="px-3 py-2">{paymentPurposeLabel(r.paymentPurpose)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(r.amount)}</td>
              </tr>
            )}
          />
        </Card>
      )}

      {priorPeriodReceipts.length > 0 && (
        <Card
          title="Khoản thu thuộc đơn của kỳ trước"
          subtitle={`Tổng ${formatVnd(bridge.priorPeriodCollections)} — làm tiền thu vào cao hơn doanh thu ghi nhận của kỳ này.`}
          icon="history"
        >
          <DataTable
            columns={[
              { key: 'code', label: 'Mã đơn' },
              { key: 'created', label: 'Ngày tạo đơn' },
              { key: 'time', label: 'Thời gian thu' },
              { key: 'method', label: 'Phương thức' },
              { key: 'purpose', label: 'Mục đích' },
              { key: 'amount', label: 'Số tiền', align: 'right' },
            ]}
            rows={priorPeriodReceipts}
            renderRow={(r, i) => (
              <tr key={`${r.orderId}-prior-${i}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                  {r.orderCode}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(r.orderCreatedAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(r.paidAt)}</td>
                <td className="px-3 py-2">{paymentMethodLabel(r.paymentMethod)}</td>
                <td className="px-3 py-2">{paymentPurposeLabel(r.paymentPurpose)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(r.amount)}</td>
              </tr>
            )}
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

export default ExceptionsTab
