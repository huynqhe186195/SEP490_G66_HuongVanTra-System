import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'

/**
 * Báo cáo là văn bản chốt kỳ, có người lập và người duyệt — khác với Thống kê
 * ở /dashboard là biểu đồ xu hướng để ra quyết định.
 */
const REPORT_TYPES = [
  {
    key: 'end-of-day',
    label: 'Báo cáo cuối ngày',
    description: 'Chốt số liệu bán hàng, thu chi và hàng hóa trong ngày theo từng bộ lọc.',
    icon: 'account_balance_wallet',
    path: '/reports/end-of-day',
    frequency: 'Hằng ngày',
    preparedBy: 'Thu ngân',
    approvedBy: 'Quản lý cửa hàng',
    available: true,
  },
  {
    key: 'inventory',
    label: 'Tồn kho',
    description: 'Chốt số lượng tồn theo từng SKU và lô tại Kho và Kệ hàng.',
    icon: 'inventory_2',
    path: '/inventory/warehouse-daily-report',
    frequency: 'Hằng ngày',
    preparedBy: 'Thủ kho',
    approvedBy: 'Quản lý cửa hàng',
    available: true,
  },
  {
    key: 'debt',
    label: 'Công nợ',
    description: 'Chốt số phải thu của khách hàng và phải trả nhà cung cấp tại thời điểm cuối kỳ.',
    icon: 'request_quote',
    frequency: 'Hằng tháng',
    preparedBy: 'Kế toán',
    approvedBy: 'Chủ cơ sở',
    available: false,
  },
  {
    key: 'cash-book',
    label: 'Sổ quỹ',
    description: 'Thu chi cộng dồn kèm số dư đầu kỳ và cuối kỳ, gồm cả các khoản không phát sinh từ bán hàng.',
    icon: 'menu_book',
    frequency: 'Hằng tháng',
    preparedBy: 'Kế toán',
    approvedBy: 'Chủ cơ sở',
    available: false,
  },
]

function MetaRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="material-symbols-outlined text-[16px] text-[#717971]">{icon}</span>
      <span className="text-[#717971]">{label}:</span>
      <span className="font-semibold text-[#414942]">{value}</span>
    </div>
  )
}

function ReportCard({ report }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              report.available ? 'bg-[#f6f4ec] text-[#356647]' : 'bg-[#f0eee6] text-[#9aa39a]'
            }`}
          >
            <span className="material-symbols-outlined">{report.icon}</span>
          </span>
          <div>
            <h3 className={`text-base font-bold ${report.available ? 'text-[#1b1c17]' : 'text-[#717971]'}`}>
              {report.label}
            </h3>
            <span className="text-xs font-semibold text-[#7e5700]">{report.frequency}</span>
          </div>
        </div>
        {report.available ? (
          <span className="material-symbols-outlined text-[#356647]">chevron_right</span>
        ) : (
          <span className="rounded-full bg-[#f0eee6] px-2.5 py-1 text-[11px] font-semibold text-[#717971]">
            Chưa triển khai
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#414942]">{report.description}</p>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e4e3db] pt-3 text-xs">
        <MetaRow icon="edit_note" label="Người lập" value={report.preparedBy} />
        <MetaRow icon="verified" label="Người duyệt" value={report.approvedBy} />
      </div>
    </>
  )

  const shell = 'rounded-2xl border bg-white p-5 shadow-sm transition'

  if (!report.available) {
    return <article className={`${shell} border-[#c1c9c0]/30 opacity-70`}>{body}</article>
  }

  return (
    <Link
      to={report.path}
      className={`${shell} block border-[#c1c9c0]/40 hover:border-[#356647]/40 hover:shadow-md`}
    >
      {body}
    </Link>
  )
}

function ReportsOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        compact
        title="Tổng quan báo cáo"
        titleInfo="Văn bản chốt kỳ để đối chiếu và lưu trữ, có người lập và người duyệt"
      />

      <div className="flex items-start gap-2 rounded-xl border border-[#fec25b]/40 bg-[#fec25b]/10 px-3 py-2.5">
        <span className="material-symbols-outlined mt-0.5 text-[18px] text-[#7e5700]">info</span>
        <p className="text-sm leading-relaxed text-[#604100]">
          <strong>Báo cáo</strong> là số liệu đã chốt tại một thời điểm, in ra ký được và lưu lại để đối chiếu. Biểu đồ xu hướng nằm ở{' '}
          <Link to="/dashboard" className="font-semibold underline">
            Thống kê bán hàng
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REPORT_TYPES.map((report) => (
          <ReportCard key={report.key} report={report} />
        ))}
      </div>
    </PageShell>
  )
}

export default ReportsOverviewPage
