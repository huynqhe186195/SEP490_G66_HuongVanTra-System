import { formatVnd } from '../../../utils/vietnamCurrency.js'

function KpiCard({ title, value, subtitle, icon, colorClass, bgClass, onClick, tooltip }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={tooltip}
      className={`flex w-full items-start gap-3 rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 text-left shadow-sm ${
        onClick ? 'transition-colors hover:border-[#356647]' : ''
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
        <span className={`material-symbols-outlined text-[20px] ${colorClass}`}>{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-[#717971]">{title}</span>
        <span className="mt-0.5 block truncate text-xl font-bold text-[#1b1c17]">{value}</span>
        {subtitle && <span className="mt-0.5 block text-[11px] leading-snug text-[#717971]">{subtitle}</span>}
      </span>
    </Tag>
  )
}

/**
 * Năm thẻ chỉ số. Ba con số đầu KHÔNG thay thế nhau:
 * doanh thu ghi nhận ≠ tổng tiền thu vào ≠ tiền mặt tại két.
 */
function ReportKpiCards({ report, exceptionCount, onOpenExceptions, showStoreWideCash }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        title="Doanh thu ghi nhận"
        value={formatVnd(report.netRecognizedRevenue)}
        subtitle={`Đã trừ hàng trả ${formatVnd(report.returnedRevenue)}`}
        tooltip="Tính từ đơn hoàn tất trong kỳ, trừ hàng trả. Không phải số tiền thực thu."
        icon="receipt_long"
        colorClass="text-[#356647]"
        bgClass="bg-[#356647]/10"
      />
      {showStoreWideCash && (
        <KpiCard
          title="Tổng tiền thu vào"
          value={formatVnd(report.totalCashIn)}
          subtitle="Gồm cả cọc và thu của đơn kỳ trước"
          tooltip="Dòng tiền thực thu theo thời điểm thanh toán, không phải doanh thu."
          icon="payments"
          colorClass="text-[#7e5700]"
          bgClass="bg-[#fec25b]/25"
        />
      )}
      <KpiCard
        title="Tổng chi ra"
        value={formatVnd(report.totalCashOut)}
        subtitle="Hoàn tiền trả hàng"
        icon="undo"
        colorClass="text-[#b42318]"
        bgClass="bg-[#b42318]/10"
      />
      <KpiCard
        title="Đơn hoàn tất"
        value={report.completedOrders}
        subtitle={`Hủy: ${report.cancelledOrders} · Hoàn tiền: ${report.refundedOrders}`}
        icon="task_alt"
        colorClass="text-[#356647]"
        bgClass="bg-[#356647]/10"
      />
      <KpiCard
        title="Ngoại lệ cần xử lý"
        value={exceptionCount}
        subtitle="Bấm để xem chi tiết"
        icon="warning"
        colorClass={exceptionCount > 0 ? 'text-[#b42318]' : 'text-[#717971]'}
        bgClass={exceptionCount > 0 ? 'bg-[#b42318]/10' : 'bg-[#f6f4ec]'}
        onClick={onOpenExceptions}
      />
    </div>
  )
}

export default ReportKpiCards
