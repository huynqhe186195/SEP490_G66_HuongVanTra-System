import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { getOrderStatusLabel } from '../../../orders/utils/orderDisplay.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../../utils/cashReportLabels.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { DocumentSection, DocumentTable, Td, KeyValueRows, DocumentNotice } from '../ReportDocumentPage.jsx'
import OrderDetailDrawer from '../OrderDetailDrawer.jsx'

const UNDERPAID_PAGE_SIZE = 20

/**
 * Tài liệu "Báo cáo cuối ngày tổng hợp".
 *
 * Gộp phần chỉ tiêu chung với phần ngoại lệ cần xử lý trước khi chốt sổ, vì cả hai đều là
 * thứ người quản lý đọc trong cùng một lượt. Ba con số doanh thu ghi nhận / tiền thu vào /
 * tiền mặt tại két được trình bày cạnh nhau kèm giải thích để không bị hiểu là thay thế nhau.
 */
function SummaryReportDocument({ report, exceptions: initialExceptions, params }) {
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [exceptions, setExceptions] = useState(initialExceptions)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPage(1)
    setExceptions(initialExceptions)
  }, [params, initialExceptions])

  useEffect(() => {
    if (page === 1) return undefined
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getExceptions({ ...params, page, pageSize: UNDERPAID_PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setExceptions(res)
      })
      .catch((err) => {
        if (signal.aborted || err.name === 'AbortError') return
        setError(err.statusCode === 403 ? 'Bạn không có quyền xem số liệu ngoại lệ.' : err.message)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [params, page])

  const hourly = report.hourlyRevenue || []
  const topProducts = (report.products || []).slice(0, 10)

  const ex = exceptions || {}
  const underpaid = ex.underpaid || []
  const receiptsOnCancelled = ex.receiptsOnCancelled || []
  const priorPeriodReceipts = ex.priorPeriodReceipts || []
  const underpaidPages = ex.totalPages || 0
  const hasException =
    (ex.underpaidCount || 0) > 0 ||
    (ex.receiptsOnCancelledCount || 0) > 0 ||
    (ex.priorPeriodReceiptCount || 0) > 0 ||
    (ex.cancelledOrders || 0) > 0 ||
    (ex.refundedOrders || 0) > 0 ||
    (ex.forfeitedDepositOrders || 0) > 0

  return (
    <>
      <DocumentSection
        title="I. Ba chỉ tiêu tài chính của kỳ"
        note="Ba con số này không thay thế cho nhau."
      >
        <DocumentTable
          columns={[
            { key: 'name', label: 'Chỉ tiêu' },
            { key: 'meaning', label: 'Cách hiểu' },
            { key: 'value', label: 'Số tiền', align: 'right' },
          ]}
          rows={[
            {
              key: 'revenue',
              label: 'Doanh thu ghi nhận',
              meaning: 'Tính từ đơn hoàn tất, đã trừ hàng trả.',
              value: report.netRecognizedRevenue,
            },
            {
              key: 'cashin',
              label: 'Tổng tiền thu vào',
              meaning: 'Tiền thực nhận trong kỳ, gồm cả cọc và đơn của kỳ trước.',
              value: report.totalCashIn,
            },
            {
              key: 'cash',
              label: 'Tiền mặt tại két',
              meaning: 'Chỉ tiền mặt. VietQR và chuyển khoản nằm ở tài khoản, không có trong két.',
              value: report.cashOnHand,
            },
          ]}
          renderRow={(r) => (
            <tr key={r.key}>
              <Td className="whitespace-nowrap font-semibold">{r.label}</Td>
              <Td muted className="text-[11px]">
                {r.meaning}
              </Td>
              <Td align="right" className="whitespace-nowrap text-[15px] font-bold">
                {formatVnd(r.value)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection title="II. Kết quả bán hàng trong kỳ">
        <KeyValueRows
          items={[
            { label: 'Đơn hoàn tất', value: report.completedOrders || 0 },
            { label: 'Doanh thu bán hàng', value: formatVnd(report.salesRevenue) },
            { label: 'Giảm giá đã áp dụng', value: formatVnd(report.salesDiscount) },
            { label: 'Giá trị hàng trả lại', value: formatVnd(report.returnedRevenue) },
            { label: 'Doanh thu ghi nhận', value: formatVnd(report.netRecognizedRevenue), strong: true },
            { label: 'Tổng chi ra', hint: 'hoàn tiền trả hàng', value: formatVnd(report.totalCashOut) },
            { label: 'Dòng tiền ròng', value: formatVnd(report.netCashFlow), strong: true },
          ]}
        />
      </DocumentSection>

      <DocumentSection title="III. Doanh thu và tiền thu theo giờ" note="Giờ Việt Nam (GMT+7)">
        <DocumentTable
          dense
          columns={[
            { key: 'hour', label: 'Khung giờ' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
            { key: 'cash', label: 'Tiền thu vào', align: 'right' },
          ]}
          rows={hourly}
          emptyText="Không có phát sinh trong kỳ."
          renderRow={(h) => (
            <tr key={h.hour}>
              <Td mono>{String(h.hour).padStart(2, '0')}:00 – {String(h.hour).padStart(2, '0')}:59</Td>
              <Td align="center">{h.orderCount ?? '—'}</Td>
              <Td align="right" className="whitespace-nowrap">
                {formatVnd(h.revenue)}
              </Td>
              <Td align="right" className="whitespace-nowrap">
                {formatVnd(h.cashIn)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection title="IV. Hàng bán chạy" note="Tối đa 10 mặt hàng theo doanh thu thuần">
        <DocumentTable
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên hàng' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={topProducts}
          emptyText="Không có hàng hóa phát sinh trong kỳ."
          renderRow={(p) => (
            <tr key={`${p.skuId}-${p.unit}`}>
              <Td mono className="whitespace-nowrap">
                {p.skuCode}
              </Td>
              <Td>{p.skuName}</Td>
              <Td align="center">{p.orderCount}</Td>
              <Td align="right" className="whitespace-nowrap font-semibold">
                {formatVnd(p.netRevenue)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection
        title="V. Ngoại lệ cần xử lý trước khi chốt sổ"
        note={hasException ? undefined : 'Không phát hiện ngoại lệ nào trong kỳ.'}
      >
        {error && (
          <p className="mb-2 border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">{error}</p>
        )}

        <KeyValueRows
          items={[
            {
              label: 'Đơn chưa thu đủ tiền',
              hint: (ex.underpaidCount || 0) > 0 ? `Còn thiếu ${formatVnd(ex.underpaidAmount)}` : undefined,
              value: ex.underpaidCount || 0,
              strong: (ex.underpaidCount || 0) > 0,
            },
            { label: 'Đơn đã hủy', value: ex.cancelledOrders || 0 },
            { label: 'Đơn có hoàn tiền', value: ex.refundedOrders || 0 },
            {
              label: 'Cọc bị giữ',
              hint: `${ex.forfeitedDepositOrders || 0} đơn hủy sau khi đã đặt cọc`,
              value: formatVnd(ex.forfeitedDepositIncome),
            },
          ]}
        />

        <DocumentNotice items={ex.dataGaps} />

        <div className="mt-4">
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#b42318]">
            Đơn chưa thu đủ tiền
          </h3>
          <p className="mb-1 text-[11px] text-[#717971]">
            Ghi nợ, COD chưa đối soát hoặc còn phần thu khi nhận hàng. Bấm vào dòng để xem chi tiết đơn.
          </p>
          <DocumentTable
            dense
            columns={[
              { key: 'code', label: 'Mã đơn' },
              { key: 'time', label: 'Thời gian' },
              { key: 'customer', label: 'Khách hàng' },
              { key: 'employee', label: 'Nhân viên' },
              { key: 'status', label: 'Trạng thái' },
              { key: 'methods', label: 'Đã thu bằng' },
              { key: 'final', label: 'Thành tiền', align: 'right' },
              { key: 'paid', label: 'Đã thu', align: 'right' },
              { key: 'missing', label: 'Còn thiếu', align: 'right' },
            ]}
            rows={underpaid}
            emptyText="Mọi đơn trong kỳ đều đã thu đủ tiền."
            renderRow={(o) => (
              <tr key={o.orderId} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-[#f6f4ec]">
                <Td mono className="whitespace-nowrap font-semibold text-[#356647]">
                  {o.orderCode}
                </Td>
                <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(o.createdAt)}</Td>
                <Td>{o.customerName || 'Khách lẻ'}</Td>
                <Td>{o.employeeName || '—'}</Td>
                <Td className="whitespace-nowrap text-[11px]">{getOrderStatusLabel(o.orderStatus)}</Td>
                <Td muted className="text-[11px]">
                  {o.paymentMethods || 'Chưa thu lần nào'}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {formatVnd(o.finalAmount)}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {formatVnd(o.paidAmount)}
                </Td>
                <Td align="right" className="whitespace-nowrap font-bold text-[#b42318]">
                  {formatVnd((o.finalAmount || 0) - (o.paidAmount || 0))}
                </Td>
              </tr>
            )}
            footer={
              (ex.underpaidCount || 0) > 0 ? (
                <tr>
                  <Td colSpan={8}>Tổng còn thiếu toàn kỳ</Td>
                  <Td align="right" className="whitespace-nowrap text-[#b42318]">
                    {formatVnd(ex.underpaidAmount)}
                  </Td>
                </tr>
              ) : null
            }
          />
          {underpaidPages > 1 && (
            <div className="mt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isLoading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full border border-[#c1c9c0] px-3 py-1 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-[#717971]">
                Trang {ex.page || page} / {underpaidPages} · {ex.underpaidCount} đơn
              </span>
              <button
                type="button"
                disabled={isLoading || page >= underpaidPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-[#c1c9c0] px-3 py-1 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          )}
        </div>

        {receiptsOnCancelled.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#7e5700]">
              Khoản thu trên đơn đã hủy
            </h3>
            <p className="mb-1 text-[11px] text-[#717971]">
              {ex.receiptsOnCancelledCount} khoản · tổng {formatVnd(ex.receiptsOnCancelledAmount)}. Tiền đã vào két
              nhưng đơn không còn hiệu lực, cần xác nhận hoàn tiền hoặc giữ cọc.
            </p>
            <DocumentTable
              dense
              columns={[
                { key: 'code', label: 'Mã đơn' },
                { key: 'time', label: 'Thời gian thu' },
                { key: 'method', label: 'Phương thức' },
                { key: 'purpose', label: 'Mục đích' },
                { key: 'amount', label: 'Số tiền', align: 'right' },
              ]}
              rows={receiptsOnCancelled}
              renderRow={(r, i) => (
                <tr key={`${r.orderId}-cancelled-${i}`}>
                  <Td mono className="whitespace-nowrap font-semibold text-[#356647]">
                    {r.orderCode}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(r.paidAt)}</Td>
                  <Td>{paymentMethodLabel(r.paymentMethod)}</Td>
                  <Td className="text-[11px]">{paymentPurposeLabel(r.paymentPurpose)}</Td>
                  <Td align="right" className="whitespace-nowrap font-semibold">
                    {formatVnd(r.amount)}
                  </Td>
                </tr>
              )}
            />
          </div>
        )}

        {priorPeriodReceipts.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#7e5700]">
              Khoản thu thuộc đơn của kỳ trước
            </h3>
            <p className="mb-1 text-[11px] text-[#717971]">
              {ex.priorPeriodReceiptCount} khoản · tổng {formatVnd(ex.priorPeriodReceiptAmount)}, làm tiền thu vào cao
              hơn doanh thu ghi nhận của kỳ này.
            </p>
            <DocumentTable
              dense
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
                  <Td mono className="whitespace-nowrap font-semibold text-[#356647]">
                    {r.orderCode}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(r.orderCreatedAt)}</Td>
                  <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(r.paidAt)}</Td>
                  <Td>{paymentMethodLabel(r.paymentMethod)}</Td>
                  <Td className="text-[11px]">{paymentPurposeLabel(r.paymentPurpose)}</Td>
                  <Td align="right" className="whitespace-nowrap font-semibold">
                    {formatVnd(r.amount)}
                  </Td>
                </tr>
              )}
            />
          </div>
        )}
      </DocumentSection>

      {selected && (
        <OrderDetailDrawer
          orderId={selected.orderId}
          orderCode={selected.orderCode}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

export default SummaryReportDocument
