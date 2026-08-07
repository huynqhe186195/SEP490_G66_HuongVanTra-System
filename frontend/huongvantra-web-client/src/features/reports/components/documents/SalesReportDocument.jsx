import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { getOrderStatusLabel } from '../../../orders/utils/orderDisplay.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { DocumentSection, DocumentTable, Td, DocumentNotice } from '../ReportDocumentPage.jsx'
import ExpandableReportGroup, { ExpandCaret } from '../ExpandableReportGroup.jsx'
import { Pagination } from '../reportUi.jsx'
import OrderDetailDrawer from '../OrderDetailDrawer.jsx'

const PAGE_SIZE = 50

const DETAIL_COLUMNS = [
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
]

/** Bảng dòng hàng bên trong một đơn, chỉ hiện khi người dùng mở rộng dòng đơn đó. */
function OrderLines({ order, onOpenDetail }) {
  return (
    <div className="bg-[#fbf9f1] px-3 py-2">
      <p className="mb-1 text-[11px] text-[#717971]">
        Đơn {order.orderCode} · {order.lineCount ?? 0} dòng hàng
      </p>
      <button
        type="button"
        onClick={() => onOpenDetail(order)}
        className="rounded-lg border border-[#356647] px-2.5 py-1 text-[11px] font-medium text-[#356647] hover:bg-[#356647]/10"
      >
        Xem chi tiết đơn hàng
      </button>
    </div>
  )
}

/**
 * Tài liệu "Báo cáo cuối ngày về bán hàng".
 *
 * Các bảng tổng hợp theo nhân viên / kênh / phương thức bán luôn hiển thị, không còn phụ
 * thuộc chế độ Tóm tắt–Chi tiết như bản tab cũ; danh sách đơn nằm ngay dưới và mở rộng
 * được từng dòng.
 */
function SalesReportDocument({ report, params, expandAll }) {
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
    if (page === 1) return undefined
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
    <>
      <DocumentSection title="I. Doanh thu theo nhân viên bán hàng">
        <DocumentTable
          columns={[
            { key: 'name', label: 'Nhân viên' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'discount', label: 'Giảm giá', align: 'right' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={report.byEmployee || []}
          renderRow={(e) => (
            <tr key={e.employeeId || e.employeeName}>
              <Td>{e.employeeName}</Td>
              <Td align="center">{e.orderCount}</Td>
              <Td align="right">{formatVnd(e.discount)}</Td>
              <Td align="right" className="font-semibold">
                {formatVnd(e.revenue)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection title="II. Doanh thu theo kênh bán">
        <DocumentTable
          columns={[
            { key: 'label', label: 'Kênh' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={report.byChannel || []}
          renderRow={(c) => (
            <tr key={c.channel}>
              <Td>{c.label}</Td>
              <Td align="center">{c.orderCount}</Td>
              <Td align="right" className="font-semibold">
                {formatVnd(c.revenue)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection title="III. Doanh thu theo phương thức bán hàng">
        <DocumentTable
          columns={[
            { key: 'label', label: 'Phương thức' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'lines', label: 'Số dòng hàng', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={report.bySalesMode || []}
          renderRow={(s) => (
            <tr key={s.salesMode}>
              <Td>{s.label}</Td>
              <Td align="center">{s.orderCount}</Td>
              <Td align="center">{s.quantity}</Td>
              <Td align="right" className="font-semibold">
                {formatVnd(s.revenue)}
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection
        title="IV. Chi tiết từng đơn hàng"
        note={`${totalCount} đơn trong kỳ · bấm vào dòng để mở rộng`}
      >
        {error && (
          <p className="mb-2 border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">{error}</p>
        )}
        <DocumentTable
          dense
          columns={DETAIL_COLUMNS}
          rows={orders}
          renderRow={(o) => (
            <ExpandableReportGroup
              key={o.orderId}
              columnCount={DETAIL_COLUMNS.length}
              forceOpen={expandAll}
              summaryRow={(open) => (
                <>
                  <Td mono className="whitespace-nowrap font-semibold text-[#356647]">
                    <ExpandCaret open={open} /> {o.orderCode}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(o.createdAt)}</Td>
                  <Td>{o.customerName || 'Khách lẻ'}</Td>
                  <Td>{o.employeeName || '—'}</Td>
                  <Td className="whitespace-nowrap text-[11px]">{o.channelLabel}</Td>
                  <Td className="whitespace-nowrap text-[11px]">{o.salesModeLabel}</Td>
                  <Td className="whitespace-nowrap text-[11px]">{getOrderStatusLabel(o.orderStatus)}</Td>
                  <Td align="center">{o.lineCount}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    {formatVnd(o.totalAmount)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {formatVnd(o.discountAmount)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap font-semibold">
                    {formatVnd(o.finalAmount)}
                  </Td>
                  <Td
                    align="right"
                    className={`whitespace-nowrap ${
                      o.paidAmount < o.finalAmount ? 'font-semibold text-[#b42318]' : ''
                    }`}
                  >
                    {formatVnd(o.paidAmount)}
                  </Td>
                  <Td className="text-[11px]">{o.paymentMethods || '—'}</Td>
                </>
              )}
            >
              <OrderLines order={o} onOpenDetail={setSelected} />
            </ExpandableReportGroup>
          )}
          footer={
            totalCount > 0 ? (
              <tr>
                <Td colSpan={9}>Tổng toàn kỳ ({totalCount} đơn)</Td>
                <Td align="right" className="whitespace-nowrap">
                  {formatVnd(report.ordersTotalDiscountAmount)}
                </Td>
                <Td align="right" className="whitespace-nowrap text-[#356647]">
                  {formatVnd(report.ordersTotalFinalAmount)}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {formatVnd(report.ordersTotalPaidAmount)}
                </Td>
                <Td />
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
      </DocumentSection>

      <DocumentNotice
        items={
          totalCount > (report.orders?.length || 0)
            ? ['Bản in và Excel sẽ tải bổ sung các trang còn lại trước khi kết xuất.']
            : null
        }
      />

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

export default SalesReportDocument
