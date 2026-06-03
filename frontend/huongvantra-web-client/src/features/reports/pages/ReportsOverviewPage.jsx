import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const topProducts = [
  {
    code: 'TXN-01',
    name: 'Tra Xanh Thai Nguyen Dac Biet',
    category: 'Tra Xanh',
    sold: '842',
    revenue: '345,220,000d',
    trend: '+15%',
    trendUp: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDNebxKEzkFwrXQ4FV2rpse18JTL9jljXCGuhXH_ZAjetkD3Jm8y_B8sbIAEeUYn2mhU42ulVK8H-zjUwnEY1D6S1lS2G1u0XcfSXRuGNZ8TvkNdN9jx5HNiTt1TbyQFocMzhRQ6hkMOFxOoW1019IPX-O4PoZ5DRnbdb91HMN_RAa5tZM9SF-J6o1BW62jtPvws8tt1M-BYwIMIfvvDZhkIWEas76Yw-B-pWeaMefYNixtrul2iugXQbWt9JxQ7sVEQJBQyHDrC15V',
  },
  {
    code: 'HT-02',
    name: 'Hong Tra Co Thu San Tuyet',
    category: 'Hong Tra',
    sold: '654',
    revenue: '212,550,000d',
    trend: '+8%',
    trendUp: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBL9WpFoGwGoOobhl9hiWZGkdbdO4DXiJTgoR3jt-dvBjh11YWzjz6e5N2R72jfYCESmKI1iIj_dF5YnsYULQ8J_CbwcvEA-MAwH0dM8i2xmE0-gmR5cn68gOvMfVBnQBtJ8EN_QBU_qd37PWpM--bt8QBN55YKnVE1B5-MzBR9WoUK3QjriVtoX0N-eo8qNl4LoWFmupruMb6I6KlLfp9Inz4kgYDCYpZbz570ihd1jMid96QZomQ-eEJ3ZXozJwc88BuB1jrjTDej',
  },
  {
    code: 'TH-03',
    name: 'Tra Hoa Cuc Tien Vua',
    category: 'Tra Hoa',
    sold: '520',
    revenue: '156,000,000d',
    trend: '-2%',
    trendUp: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD4a1mbU4uopdZ6rMwKXvFo8wtqwN56RIr6xPlHVCcrmZQOWQnvGPDdWgV6M1N2ACr6q8BK3rUjVWOEflSVjBxulZxg4sikkQNpeCTP2Y1gfKSfIlQw-5uJGxLOEJW4kY310aEhFMk0tWyijFUFqzsM8OkLW8VE2ltfthU9m6h6Bthuvt_DCWVRskStE4NCtxFRjp2LcRdrCbk_mo-Bq29ymRwJkjD4IPGZsUc7pEdxL27zF1WLvyaHV2KD38_B4Pr-1fIWaF7O46J9',
  },
  {
    code: 'MT-04',
    name: 'Bot Matcha Cao Cap',
    category: 'Matcha',
    sold: '412',
    revenue: '123,600,000d',
    trend: '+24%',
    trendUp: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAwL4mlg2mtJaymfOSthivwJYzdeZzV1Ebxh1VpuL7EyaEeReL5Swdyr2BgHwNDvZP4TeI3GSS1N-ihn2IuNGgumnd14l_YM246blOAe3bd9-Zy7LWsDF4r-CfjzN8eeAqvG7LgQlNnSi4sn7mb91JL-9qIC64oj6Cg5wGIoBrQBPxVy9Szd9iaqlxS5XRvGj2Mfa83uKmcxewrwFVD5ViueOK-nXAo62iOLeRawcKdfgE95Fy_ypdSLOx9uXe1mrh_jc9R-QDujtW7',
  },
  {
    code: 'PN-05',
    name: 'Tra Pho Nhi 10 Nam',
    category: 'Tra Pho Nhi',
    sold: '320',
    revenue: '112,000,000d',
    trend: '0%',
    trendUp: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDcfDXsyKOXryudoplJhByulREgM1oVod5jdBs6KQii1nuWHIaBOO_T_jYRNG2N-vqE8_8FMsB4n-pmTE1yYxrn-bvQ6ZdfK0ZQdimDv-M2ju3K1-0ol3uOUKNPfJwk6v2iFP2NJRe23Q-1NL29l6L0w3A-Mo-iDb46nhKNqMP0KDVUJc3UVsi8Ovux5Sbqe64umQlTKOB29Zh1rcdhkT4ab6Xjo2c4p0z4XUKh3Sapq2z7B2fqd7dbylavz3To7OetZqmDRjPLOq_X',
  },
]

const channelRows = [
  { icon: 'store', label: 'Tại cửa hàng', percent: 52, colorClass: 'bg-[#7e5700]', textClass: 'text-[#7e5700]' },
  { icon: 'chat', label: 'Zalo / Facebook', percent: 34, colorClass: 'bg-[#356647]', textClass: 'text-[#356647]' },
  { icon: 'phone_in_talk', label: 'Gọi điện', percent: 14, colorClass: 'bg-[#4a6242]', textClass: 'text-[#4a6242]' },
]

const revenueBars = ['h-2/3', 'h-3/4', 'h-1/2', 'h-full', 'h-4/5', 'h-2/3']
const weekLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function ReportsOverviewPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Báo cáo doanh thu"
        description="Tổng quan doanh thu, lợi nhuận, kênh bán và top sản phẩm"
        searchPlaceholder="Tìm báo cáo, doanh số..."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#c1c9c0]/30 bg-white p-3 shadow-sm">
        <Link to="/reports" className="rounded-full bg-[#356647] px-4 py-2 text-xs font-semibold text-white">
          Tổng quan
        </Link>
        <Link to="/reports/customers" className="rounded-full bg-[#eae8e0] px-4 py-2 text-xs font-semibold text-[#414942]">
          Khách hàng
        </Link>
      </div>

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="md:col-span-2 rounded-xl border-l-4 border-[#356647] bg-[#ffffff] p-5 shadow-sm">
            <p className="text-sm text-[#414942]">Tổng doanh thu (tháng này)</p>
            <h2 className="mt-2 text-4xl font-bold text-[#356647]">1.284.500.000d</h2>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-[#356647]">trending_up</span>
              <span className="font-bold text-[#356647]">+12.5%</span>
              <span className="text-[#717971]">so với tháng trước</span>
            </div>
          </article>

          <article className="rounded-xl border-l-4 border-[#4a6242] bg-[#ffffff] p-5 shadow-sm">
            <p className="text-sm text-[#414942]">Biên lợi nhuận</p>
            <div className="relative mx-auto mt-3 h-24 w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-[#e4e3db]" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[#4a6242]"
                  strokeDasharray="251.2"
                  strokeDashoffset="80"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#4a6242]">68%</span>
            </div>
          </article>

          <article className="rounded-xl bg-[#627b59] p-5 text-[#f8ffef] shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="text-sm font-semibold">Đơn hàng mới</span>
            </div>
            <p className="text-3xl font-bold">4,832</p>
            <p className="mt-1 text-xs opacity-85">Đang xử lý: 42 đơn</p>
          </article>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="xl:col-span-2 rounded-xl bg-[#ffffff] p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#1b1c17]">Xu hướng doanh thu</h3>
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" className="rounded-full bg-[#4e7f5e] px-3 py-1 text-white">
                  Tuần
                </button>
                <button type="button" className="rounded-full bg-[#f0eee6] px-3 py-1 text-[#717971]">
                  Tháng
                </button>
              </div>
            </div>

            <div className="relative flex h-64 items-end gap-3 overflow-hidden pt-8">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <div className="w-full border-t border-dashed border-[#c1c9c0]" />
                <div className="w-full border-t border-dashed border-[#c1c9c0]" />
                <div className="w-full border-t border-dashed border-[#c1c9c0]" />
                <div className="w-full border-t border-dashed border-[#c1c9c0]" />
              </div>

              {revenueBars.map((barClass, index) => (
                <div key={`${weekLabels[index]}-${barClass}`} className={`group relative flex-1 rounded-t-lg bg-[#356647]/20 ${barClass}`}>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-[#1b1c17] px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {`${100 + index * 18}tr`}
                  </div>
                  <div className="h-full w-full rounded-t-lg bg-[#356647]/40" />
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between px-1 text-xs font-semibold text-[#717971]">
              {weekLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#ffffff] p-5 shadow-sm">
            <h3 className="mb-5 text-xl font-semibold text-[#1b1c17]">Kênh bán hàng</h3>
            <div className="space-y-5">
              {channelRows.map((channel) => (
                <div key={channel.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined ${channel.textClass}`}>{channel.icon}</span>
                      <span className="text-sm font-semibold text-[#1b1c17]">{channel.label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#1b1c17]">{channel.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0eee6]">
                    <div className={`h-full ${channel.colorClass}`} style={{ width: `${channel.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-[#fec25b]/30 bg-[#fec25b]/15 p-3 text-xs italic text-[#744f00]">
              Lượt mua qua Zalo tăng 12% so với tuần trước nhờ chiến dịch Trà Thu.
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-[#1b1c17]">Top 5 sản phẩm bán chạy</h3>
            <Link to="/products" className="text-sm font-semibold text-[#356647] hover:underline">
              Xem tất cả
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#c1c9c0] text-xs uppercase tracking-wide text-[#717971]">
                  <th className="pb-4 pl-2">Sản phẩm</th>
                  <th className="pb-4">Phân loại</th>
                  <th className="pb-4 text-center">Số lượng</th>
                  <th className="pb-4 text-right">Doanh thu</th>
                  <th className="pb-4 pr-2 text-right">Xu hướng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e3db]">
                {topProducts.map((product) => (
                  <tr key={product.code} className="transition-colors hover:bg-[#f6f4ec]">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <img src={product.image} alt={product.name} className="h-11 w-11 rounded-lg object-cover" />
                        <span className="font-semibold text-[#1b1c17]">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-[#414942]">{product.category}</td>
                    <td className="py-4 text-center font-medium text-[#1b1c17]">{product.sold}</td>
                    <td className="py-4 text-right font-bold text-[#356647]">{product.revenue}</td>
                    <td className="py-4 pr-2 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 text-sm font-semibold ${product.trendUp ? 'text-[#356647]' : 'text-[#ba1a1a]'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{product.trendUp ? 'arrow_upward' : 'arrow_downward'}</span>
                        {product.trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <button
        type="button"
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#356647] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Quick add"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>
    </div>
  )
}

export default ReportsOverviewPage
