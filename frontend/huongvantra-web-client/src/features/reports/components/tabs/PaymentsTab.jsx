import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../../utils/cashReportLabels.js'
import { Card, DataTable } from '../reportUi.jsx'

/** Bảng thu/chi theo nhóm. */
function FlowTable({ lines, totalLabel, total, accent }) {
  return (
    <DataTable
      columns={[
        { key: 'label', label: 'Khoản mục' },
        { key: 'count', label: 'Số lượt', align: 'center' },
        { key: 'amount', label: 'Số tiền', align: 'right' },
      ]}
      rows={lines}
      renderRow={(l) => (
        <tr key={l.key}>
          <td className="px-3 py-2 font-medium text-[#1b1c17]">{l.label}</td>
          <td className="px-3 py-2 text-center text-[#717971]">{l.count}</td>
          <td className="px-3 py-2 text-right font-semibold">{formatVnd(l.amount)}</td>
        </tr>
      )}
      footer={
        <tr>
          <td colSpan={2} className="px-3 py-2">
            {totalLabel}
          </td>
          <td className={`px-3 py-2 text-right ${accent}`}>{formatVnd(total)}</td>
        </tr>
      }
    />
  )
}

function BridgeRow({ label, amount, sign, note, strong }) {
  return (
    <tr className={strong ? 'bg-[#f6f4ec] font-bold text-[#1b1c17]' : ''}>
      <td className="px-3 py-2 text-center text-[#717971]">{sign}</td>
      <td className="px-3 py-2">
        <span className={strong ? 'font-bold' : 'font-medium text-[#1b1c17]'}>{label}</span>
        {note && <span className="mt-0.5 block text-[11px] font-normal text-[#717971]">{note}</span>}
      </td>
      <td className="px-3 py-2 text-right font-semibold">{formatVnd(amount)}</td>
    </tr>
  )
}

function PaymentsTab({ report, mode }) {
  const byMethod = report.byPaymentMethod || []
  const cashLines = byMethod.filter((m) => m.isCash)
  const bankLines = byMethod.filter((m) => !m.isCash)
  const bridge = report.bridge || {}

  const cashNet = cashLines.reduce((s, m) => s + (m.net || 0), 0)
  const bankNet = bankLines.reduce((s, m) => s + (m.net || 0), 0)

  const computedTotal =
    (bridge.recognizedRevenue || 0) -
    (bridge.unpaidRevenue || 0) +
    (bridge.priorPeriodCollections || 0) +
    (bridge.forfeitedDeposit || 0) -
    (bridge.refunds || 0)
  const bridgeGap = (bridge.totalCashIn || 0) - computedTotal

  const methodColumns = [
    { key: 'label', label: 'Phương thức' },
    { key: 'count', label: 'Số lượt', align: 'center' },
    { key: 'in', label: 'Thu vào', align: 'right' },
    { key: 'out', label: 'Chi ra', align: 'right' },
    { key: 'net', label: 'Còn lại', align: 'right' },
  ]

  const renderMethodRow = (m) => (
    <tr key={m.paymentMethod}>
      <td className="px-3 py-2 font-medium text-[#1b1c17]">{m.label}</td>
      <td className="px-3 py-2 text-center text-[#717971]">{m.count}</td>
      <td className="px-3 py-2 text-right">{formatVnd(m.amountIn)}</td>
      <td className="px-3 py-2 text-right text-[#b42318]">{formatVnd(m.amountOut)}</td>
      <td className="px-3 py-2 text-right font-semibold">{formatVnd(m.net)}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <Card
        title="Tổng hợp dòng tiền theo phương thức thanh toán"
        subtitle="Chưa có số kiểm đếm thực tế nên đây chưa phải đối soát két."
        icon="account_balance_wallet"
      >
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#356647]">Tiền mặt tại két</h4>
            <DataTable
              columns={methodColumns}
              rows={cashLines}
              renderRow={renderMethodRow}
              emptyText="Không có giao dịch tiền mặt"
              footer={
                <tr>
                  <td colSpan={4} className="px-3 py-2">
                    Tiền mặt phải có trong két
                  </td>
                  <td className="px-3 py-2 text-right text-[#356647]">{formatVnd(cashNet)}</td>
                </tr>
              }
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7e5700]">
              Tiền vào tài khoản (VietQR, chuyển khoản)
            </h4>
            <DataTable
              columns={methodColumns}
              rows={bankLines}
              renderRow={renderMethodRow}
              emptyText="Không có giao dịch qua tài khoản"
              footer={
                <tr>
                  <td colSpan={4} className="px-3 py-2">
                    Tiền phải có trong tài khoản
                  </td>
                  <td className="px-3 py-2 text-right text-[#7e5700]">{formatVnd(bankNet)}</td>
                </tr>
              }
            />
          </div>
        </div>
      </Card>

      <Card
        title="Cầu nối doanh thu và dòng tiền"
        subtitle="Giải thích vì sao doanh thu ghi nhận khác tổng tiền thu vào."
        icon="compare_arrows"
      >
        <table className="w-full text-left text-sm text-[#414942]">
          <tbody className="divide-y divide-[#c1c9c0]/30">
            <BridgeRow sign="" label="Doanh thu ghi nhận" amount={bridge.recognizedRevenue} strong />
            <BridgeRow
              sign="−"
              label="Doanh thu chưa thu tiền"
              amount={bridge.unpaidRevenue}
              note="Đơn ghi nợ, COD chưa đối soát."
            />
            <BridgeRow
              sign="+"
              label="Tiền thu của đơn kỳ trước"
              amount={bridge.priorPeriodCollections}
              note="Cọc hoặc phần còn lại thu trong kỳ này nhưng đơn tạo từ kỳ trước."
            />
            <BridgeRow
              sign="+"
              label="Cọc bị giữ do hủy đơn"
              amount={bridge.forfeitedDeposit}
              note="Thu nhập khác, không tính vào doanh thu bán hàng."
            />
            <BridgeRow sign="−" label="Hoàn tiền trả hàng" amount={bridge.refunds} />
            <BridgeRow sign="=" label="Tổng tiền thu vào" amount={bridge.totalCashIn} strong />
          </tbody>
        </table>
        {Math.abs(bridgeGap) > 1 && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-[#fbf9f1] p-3 text-xs text-[#7e5700]">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Còn chênh lệch {formatVnd(bridgeGap)} chưa giải thích được. Thường do đơn hoàn tất ở kỳ này nhưng
            hàng trả thuộc đơn của kỳ khác.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Tiền thu vào theo mục đích" icon="south_east">
          <FlowTable
            lines={report.cashIn || []}
            totalLabel="Tổng thu vào"
            total={report.totalCashIn}
            accent="text-[#356647]"
          />
        </Card>
        <Card title="Tiền chi ra (hoàn trả hàng)" icon="north_east">
          <FlowTable
            lines={report.cashOut || []}
            totalLabel="Tổng chi ra"
            total={report.totalCashOut}
            accent="text-[#b42318]"
          />
        </Card>
      </div>

      <Card title="Thu nhập khác" subtitle="Không tính vào doanh thu bán hàng" icon="savings">
        <div className="flex items-center justify-between rounded-xl bg-[#fbf9f1] px-4 py-3">
          <span className="text-sm text-[#414942]">
            Cọc bị giữ do hủy đơn ({report.forfeitedDepositOrders} đơn)
          </span>
          <span className="text-base font-bold text-[#7e5700]">{formatVnd(report.forfeitedDepositIncome)}</span>
        </div>
      </Card>

      {mode === 'detail' && (
        <Card
          title="Chi tiết các khoản thu"
          subtitle={`${(report.receipts || []).length} giao dịch`}
          icon="receipt"
        >
          <DataTable
            columns={[
              { key: 'code', label: 'Mã đơn' },
              { key: 'time', label: 'Thời điểm thu' },
              { key: 'method', label: 'Phương thức' },
              { key: 'purpose', label: 'Mục đích' },
              { key: 'customer', label: 'Khách hàng' },
              { key: 'employee', label: 'Nhân viên' },
              { key: 'amount', label: 'Số tiền', align: 'right' },
            ]}
            rows={report.receipts || []}
            renderRow={(r, i) => (
              <tr key={`${r.orderId}-${r.paidAt}-${i}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#356647]">
                  {r.orderCode}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(r.paidAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">{paymentMethodLabel(r.paymentMethod)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{paymentPurposeLabel(r.paymentPurpose)}</td>
                <td className="px-3 py-2">{r.customerName || 'Khách lẻ'}</td>
                <td className="px-3 py-2">{r.employeeName || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(r.amount)}</td>
              </tr>
            )}
          />
        </Card>
      )}
    </div>
  )
}

export default PaymentsTab
