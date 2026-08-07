import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../../utils/cashReportLabels.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { DocumentSection, DocumentTable, Td } from '../ReportDocumentPage.jsx'
import { Pagination } from '../reportUi.jsx'

const PAGE_SIZE = 50

const METHOD_COLUMNS = [
  { key: 'label', label: 'Phương thức' },
  { key: 'count', label: 'Số lượt', align: 'center' },
  { key: 'in', label: 'Thu vào', align: 'right' },
  { key: 'out', label: 'Chi ra', align: 'right' },
  { key: 'net', label: 'Còn lại', align: 'right' },
]

function MethodRow(m) {
  return (
    <tr key={m.paymentMethod}>
      <Td>{m.label}</Td>
      <Td align="center" muted>
        {m.count}
      </Td>
      <Td align="right">{formatVnd(m.amountIn)}</Td>
      <Td align="right" className="text-[#b42318]">
        {formatVnd(m.amountOut)}
      </Td>
      <Td align="right" className="font-semibold">
        {formatVnd(m.net)}
      </Td>
    </tr>
  )
}

function FlowTable({ lines, totalLabel, total, accent }) {
  return (
    <DocumentTable
      columns={[
        { key: 'label', label: 'Khoản mục' },
        { key: 'count', label: 'Số lượt', align: 'center' },
        { key: 'amount', label: 'Số tiền', align: 'right' },
      ]}
      rows={lines}
      renderRow={(l) => (
        <tr key={l.key}>
          <Td>{l.label}</Td>
          <Td align="center" muted>
            {l.count}
          </Td>
          <Td align="right" className="font-semibold">
            {formatVnd(l.amount)}
          </Td>
        </tr>
      )}
      footer={
        <tr>
          <Td colSpan={2}>{totalLabel}</Td>
          <Td align="right" className={accent}>
            {formatVnd(total)}
          </Td>
        </tr>
      }
    />
  )
}

function BridgeRow({ label, amount, sign, note, strong }) {
  return (
    <tr className={strong ? 'bg-[#f1efe7] font-bold' : ''}>
      <Td align="center" muted className="w-8">
        {sign}
      </Td>
      <Td>
        {label}
        {note && <span className="mt-0.5 block text-[11px] font-normal text-[#717971]">{note}</span>}
      </Td>
      <Td align="right" className="w-48 font-semibold">
        {formatVnd(amount)}
      </Td>
    </tr>
  )
}

/**
 * Tài liệu "Báo cáo cuối ngày về thanh toán".
 *
 * Giữ nguyên cách tách tiền mặt / tài khoản theo cờ `isCash` do backend trả về và bảng cầu
 * nối doanh thu ↔ dòng tiền. Danh sách khoản thu luôn hiển thị, không còn cổng chế độ
 * Tóm tắt–Chi tiết.
 */
function PaymentsReportDocument({ report, params }) {
  const byMethod = report.byPaymentMethod || []
  const cashLines = byMethod.filter((m) => m.isCash)
  const bankLines = byMethod.filter((m) => !m.isCash)
  const bridge = report.bridge || {}

  const [page, setPage] = useState(1)
  const [pageItems, setPageItems] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPage(1)
    setPageItems(null)
  }, [params])

  useEffect(() => {
    if (page === 1) return undefined
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getPayments({ ...params, page, pageSize: PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setPageItems(res?.items || [])
      })
      .catch((err) => {
        if (signal.aborted || err.name === 'AbortError') return
        setError(err.statusCode === 403 ? 'Bạn không có quyền xem danh sách khoản thu.' : err.message)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [params, page])

  const receiptTotalCount = report.receiptsTotalCount || 0
  const receiptTotalPages = Math.ceil(receiptTotalCount / PAGE_SIZE)
  const receipts = page === 1 ? (report.receipts || []).slice(0, PAGE_SIZE) : pageItems || []

  const cashNet = report.cashOnHand ?? cashLines.reduce((s, m) => s + (m.net || 0), 0)
  const bankNet = report.bankIn ?? bankLines.reduce((s, m) => s + (m.net || 0), 0)

  const computedTotal =
    (bridge.recognizedRevenue || 0) -
    (bridge.unpaidRevenue || 0) +
    (bridge.priorPeriodCollections || 0) +
    (bridge.advanceOnOpenOrders || 0) +
    (bridge.forfeitedDeposit || 0) -
    (bridge.refunds || 0)
  const bridgeGap = (bridge.totalCashIn || 0) - computedTotal

  return (
    <>
      <DocumentSection
        title="I. Dòng tiền theo phương thức thanh toán"
        note="Chưa có số kiểm đếm thực tế nên đây chưa phải đối soát két."
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#356647]">Tiền mặt tại két</h3>
            <DocumentTable
              columns={METHOD_COLUMNS}
              rows={cashLines}
              renderRow={MethodRow}
              emptyText="Không có giao dịch tiền mặt"
              footer={
                <tr>
                  <Td colSpan={4}>Tiền mặt phải có trong két</Td>
                  <Td align="right" className="text-[#356647]">
                    {formatVnd(cashNet)}
                  </Td>
                </tr>
              }
            />
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#7e5700]">
              Tiền vào tài khoản (VietQR, chuyển khoản)
            </h3>
            <DocumentTable
              columns={METHOD_COLUMNS}
              rows={bankLines}
              renderRow={MethodRow}
              emptyText="Không có giao dịch qua tài khoản"
              footer={
                <tr>
                  <Td colSpan={4}>Tiền phải có trong tài khoản</Td>
                  <Td align="right" className="text-[#7e5700]">
                    {formatVnd(bankNet)}
                  </Td>
                </tr>
              }
            />
          </div>
        </div>
      </DocumentSection>

      <DocumentSection
        title="II. Cầu nối doanh thu và dòng tiền"
        note="Giải thích vì sao doanh thu ghi nhận khác tổng tiền thu vào."
      >
        <table className="w-full border-collapse text-[13px]">
          <tbody>
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
              label="Tiền thu trước của đơn chưa hoàn tất"
              amount={bridge.advanceOnOpenOrders}
              note="Đơn chờ nguyên vật liệu, chờ sản xuất, chờ điều chuyển. Tiền đã vào két nhưng chưa giao hàng nên chưa ghi nhận doanh thu."
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
          <p className="mt-2 border border-[#fec25b] bg-[#fec25b]/10 px-3 py-2 text-[11px] text-[#7e5700]">
            Còn chênh lệch {formatVnd(bridgeGap)} chưa giải thích được. Thường do hàng trả trong kỳ thuộc đơn của
            kỳ trước, hoặc đơn đổi trạng thái sau khi đã thu tiền.
          </p>
        )}
      </DocumentSection>

      <DocumentSection title="III. Thu vào và chi ra theo mục đích">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#356647]">Tiền thu vào</h3>
            <FlowTable
              lines={report.cashIn || []}
              totalLabel="Tổng thu vào"
              total={report.totalCashIn}
              accent="text-[#356647]"
            />
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#b42318]">
              Tiền chi ra (hoàn trả hàng)
            </h3>
            <FlowTable
              lines={report.cashOut || []}
              totalLabel="Tổng chi ra"
              total={report.totalCashOut}
              accent="text-[#b42318]"
            />
          </div>
        </div>
      </DocumentSection>

      <DocumentSection title="IV. Thu nhập khác" note="Không tính vào doanh thu bán hàng">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <Td>Cọc bị giữ do hủy đơn ({report.forfeitedDepositOrders} đơn)</Td>
              <Td align="right" className="w-48 font-bold text-[#7e5700]">
                {formatVnd(report.forfeitedDepositIncome)}
              </Td>
            </tr>
          </tbody>
        </table>
      </DocumentSection>

      <DocumentSection
        title="V. Chi tiết các khoản thu"
        note={`${receiptTotalCount} giao dịch trong kỳ · tổng ${formatVnd(report.receiptsTotalAmount)}`}
      >
        {error && (
          <p className="mb-2 border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">{error}</p>
        )}
        <DocumentTable
          dense
          columns={[
            { key: 'code', label: 'Mã đơn' },
            { key: 'time', label: 'Thời điểm thu' },
            { key: 'method', label: 'Phương thức' },
            { key: 'purpose', label: 'Mục đích' },
            { key: 'customer', label: 'Khách hàng' },
            { key: 'employee', label: 'Nhân viên' },
            { key: 'amount', label: 'Số tiền', align: 'right' },
          ]}
          rows={receipts}
          renderRow={(r, i) => (
            <tr key={`${r.orderId}-${r.paidAt}-${i}`}>
              <Td mono className="whitespace-nowrap font-semibold text-[#356647]">
                {r.orderCode}
              </Td>
              <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(r.paidAt)}</Td>
              <Td className="whitespace-nowrap">{paymentMethodLabel(r.paymentMethod)}</Td>
              <Td className="whitespace-nowrap text-[11px]">{paymentPurposeLabel(r.paymentPurpose)}</Td>
              <Td>{r.customerName || 'Khách lẻ'}</Td>
              <Td>{r.employeeName || '—'}</Td>
              <Td align="right" className="whitespace-nowrap font-semibold">
                {formatVnd(r.amount)}
              </Td>
            </tr>
          )}
          footer={
            receiptTotalCount > 0 ? (
              <tr>
                <Td colSpan={6}>Tổng thu toàn kỳ</Td>
                <Td align="right" className="whitespace-nowrap text-[#356647]">
                  {formatVnd(report.receiptsTotalAmount)}
                </Td>
              </tr>
            ) : null
          }
        />
        <Pagination
          page={page}
          totalPages={receiptTotalPages}
          totalCount={receiptTotalCount}
          unitLabel="khoản thu"
          isLoading={isLoading}
          onChange={setPage}
        />
      </DocumentSection>
    </>
  )
}

export default PaymentsReportDocument
