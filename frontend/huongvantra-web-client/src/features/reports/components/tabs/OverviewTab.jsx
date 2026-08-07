import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { Card, DataTable } from '../reportUi.jsx'

const DONUT_COLORS = ['#356647', '#fec25b', '#7e5700', '#8aa895', '#b42318', '#414942']

function compactVnd(value) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function OverviewTab({ report }) {
  const hourly = (report.hourlyRevenue || []).map((h) => ({
    ...h,
    label: `${String(h.hour).padStart(2, '0')}h`,
  }))

  const donut = (report.byPaymentMethod || [])
    .filter((m) => m.amountIn > 0)
    .map((m) => ({ name: m.label, value: m.amountIn }))

  const topProducts = (report.products || []).slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Ba con số này không thay thế nhau — spec yêu cầu nói rõ để tránh hiểu nhầm. */}
      <div className="rounded-2xl border border-[#fec25b] bg-[#fbf9f1] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#7e5700]">
          <span className="material-symbols-outlined text-[18px]">info</span>
          Ba con số dưới đây không thay thế cho nhau
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[#717971]">Doanh thu ghi nhận</p>
            <p className="mt-1 text-lg font-bold text-[#1b1c17]">{formatVnd(report.netRecognizedRevenue)}</p>
            <p className="mt-1 text-[11px] text-[#717971]">Tính từ đơn hoàn tất, đã trừ hàng trả.</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[#717971]">Tổng tiền thu vào</p>
            <p className="mt-1 text-lg font-bold text-[#1b1c17]">{formatVnd(report.totalCashIn)}</p>
            <p className="mt-1 text-[11px] text-[#717971]">
              Tiền thực nhận trong kỳ, gồm cả cọc và đơn của kỳ trước.
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[#717971]">Tiền mặt tại két</p>
            <p className="mt-1 text-lg font-bold text-[#1b1c17]">{formatVnd(report.cashOnHand)}</p>
            <p className="mt-1 text-[11px] text-[#717971]">
              Chỉ tiền mặt. VietQR và chuyển khoản vào tài khoản, không nằm trong két.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Doanh thu và tiền thu theo giờ"
          subtitle="Giờ Việt Nam (GMT+7)"
          icon="show_chart"
          className="xl:col-span-2"
        >
          {hourly.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#717971]">Không có phát sinh trong kỳ.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hourly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c1c9c0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#717971' }} />
                <YAxis tickFormatter={compactVnd} tick={{ fontSize: 12, fill: '#717971' }} />
                <Tooltip formatter={(v) => formatVnd(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#356647" strokeWidth={2} />
                <Line type="monotone" dataKey="cashIn" name="Tiền thu vào" stroke="#7e5700" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Cơ cấu tiền thu theo phương thức" icon="donut_small">
          {donut.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#717971]">Không có khoản thu nào.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {donut.map((entry, i) => (
                    <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatVnd(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Hàng bán chạy" subtitle="Tối đa 10 mặt hàng theo doanh thu" icon="trending_up">
        <DataTable
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên hàng' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={topProducts}
          renderRow={(p) => (
            <tr key={p.skuId}>
              <td className="px-3 py-2 font-mono text-xs">{p.skuCode}</td>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{p.skuName}</td>
              <td className="px-3 py-2 text-center">{p.orderCount}</td>
              <td className="px-3 py-2 text-right font-semibold">{formatVnd(p.netRevenue)}</td>
            </tr>
          )}
        />
      </Card>
    </div>
  )
}

export default OverviewTab
