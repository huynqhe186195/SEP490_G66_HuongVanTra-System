import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { getOrderStatusLabel, getOrderStatusClass } from '../../../orders/utils/orderDisplay.js'
import { paymentMethodLabel, paymentPurposeLabel } from '../../utils/cashReportLabels.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { Card, DataTable, EmptyState } from '../reportUi.jsx'
import OrderDetailDrawer from '../OrderDetailDrawer.jsx'

const PAGE_SIZE = 20

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
 * Tab Ngoại lệ gom các trường hợp cần xử lý trước khi chốt sổ: đơn chưa thu đủ tiền,
 * tiền thu trên đơn đã hủy, và khoản thu lệch kỳ.
 *
 * Mọi con số đếm và tổng tiền lấy nguyên từ backend vì chúng tính trên toàn kỳ. Nếu tự lọc
 * từ danh sách đang hiển thị thì phân trang phía server sẽ làm số ngoại lệ báo thiếu.
 * Trang đầu dùng lại dữ liệu trang cha đã tải; chỉ khi lật trang mới gọi thêm API.
 */
function ExceptionsTab({ data: initialData, params }) {
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Đổi bộ lọc thì quay lại trang đầu và bám theo dữ liệu trang cha vừa tải.
  useEffect(() => {
    setPage(1)
    setData(initialData)
  }, [params, initialData])

  useEffect(() => {
    if (page === 1) return
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getExceptions({ ...params, page, pageSize: PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setData(res)
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

  if (!data) {
    return <EmptyState text="Chưa có dữ liệu ngoại lệ." hint="Chọn kỳ báo cáo và bấm Áp dụng." />
  }

  const underpaid = data.underpaid || []
  const receiptsOnCancelled = data.receiptsOnCancelled || []
  const priorPeriodReceipts = data.priorPeriodReceipts || []
  const totalPages = data.totalPages || 0

  const hasAnything =
    (data.underpaidCount || 0) > 0 ||
    (data.receiptsOnCancelledCount || 0) > 0 ||
    (data.priorPeriodReceiptCount || 0) > 0 ||
    (data.cancelledOrders || 0) > 0 ||
    (data.refundedOrders || 0) > 0 ||
    (data.forfeitedDepositOrders || 0) > 0

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
      {error && (
        <div className="rounded-2xl border border-[#b42318]/40 bg-[#b42318]/5 p-3 text-sm text-[#b42318]">{error}</div>
      )}

      {(data.dataGaps || []).length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#7e5700]/40 bg-[#fec25b]/15 p-3">
          <span className="material-symbols-outlined text-[18px] text-[#7e5700]">info</span>
          <ul className="space-y-0.5 text-sm text-[#7e5700]">
            {data.dataGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Đơn chưa thu đủ tiền"
          value={data.underpaidCount || 0}
          tone={data.underpaidCount ? 'danger' : 'neutral'}
          hint={data.underpaidCount ? `Còn thiếu ${formatVnd(data.underpaidAmount)}` : undefined}
        />
        <Tile label="Đơn đã hủy" value={data.cancelledOrders || 0} tone="warn" />
        <Tile label="Đơn có hoàn tiền" value={data.refundedOrders || 0} tone="warn" />
        <Tile
          label="Cọc bị giữ"
          value={formatVnd(data.forfeitedDepositIncome)}
          hint={`${data.forfeitedDepositOrders || 0} đơn hủy sau khi đã đặt cọc`}
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
            { key: 'methods', label: 'Đã thu bằng' },
            { key: 'final', label: 'Thành tiền', align: 'right' },
            { key: 'paid', label: 'Đã thu', align: 'right' },
            { key: 'missing', label: 'Còn thiếu', align: 'right' },
          ]}
          rows={underpaid}
          emptyText="Mọi đơn trong kỳ đều đã thu đủ tiền."
          renderRow={(o) => (
            <tr key={o.orderId} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-[#f6f4ec]">
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
              <td className="px-3 py-2 text-xs text-[#717971]">{o.paymentMethods || 'Chưa thu lần nào'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.finalAmount)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(o.paidAmount)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-[#b42318]">
                {formatVnd((o.finalAmount || 0) - (o.paidAmount || 0))}
              </td>
            </tr>
          )}
          footer={
            (data.underpaidCount || 0) > 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-2 text-right">
                  Tổng còn thiếu toàn kỳ
                </td>
                <td className="px-3 py-2 text-right text-[#b42318]">{formatVnd(data.underpaidAmount)}</td>
              </tr>
            ) : null
          }
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[#c1c9c0]/40 px-3 py-2">
            <p className="text-xs text-[#717971]">
              Trang {data.page || page}/{totalPages} · {data.underpaidCount} đơn
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLoading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={isLoading || page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </Card>

      {receiptsOnCancelled.length > 0 && (
        <Card
          title="Khoản thu trên đơn đã hủy"
          subtitle={`${data.receiptsOnCancelledCount} khoản · tổng ${formatVnd(
            data.receiptsOnCancelledAmount,
          )}. Tiền đã vào két nhưng đơn không còn hiệu lực — cần xác nhận hoàn tiền hoặc giữ cọc.`}
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
          subtitle={`${data.priorPeriodReceiptCount} khoản · tổng ${formatVnd(
            data.priorPeriodReceiptAmount,
          )} — làm tiền thu vào cao hơn doanh thu ghi nhận của kỳ này.`}
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
