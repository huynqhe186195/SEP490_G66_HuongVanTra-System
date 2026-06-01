import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const customerRows = [
  {
    code: 'HVT-2901',
    initials: 'TH',
    name: 'Nguyen Thanh Huyen',
    tier: 'VIP Kim Cuong',
    joinedAt: '12/05/2021',
    orders: 42,
    spent: '85,200,000',
  },
  {
    code: 'HVT-1102',
    initials: 'AV',
    name: 'Tran Anh Vu',
    tier: 'VIP Vang',
    joinedAt: '05/01/2022',
    orders: 28,
    spent: '34,500,000',
  },
  {
    code: 'HVT-3452',
    initials: 'MN',
    name: 'Le Minh Ngoc',
    tier: 'Thanh vien',
    joinedAt: '22/08/2023',
    orders: 12,
    spent: '12,800,000',
  },
  {
    code: 'HVT-8821',
    initials: 'PA',
    name: 'Hoang Phan Anh',
    tier: 'VIP Kim Cuong',
    joinedAt: '15/03/2020',
    orders: 56,
    spent: '112,000,000',
  },
]

function tierBadgeClass(tier) {
  if (tier === 'VIP Kim Cuong') {
    return 'bg-[#ffdead] text-[#281900]'
  }

  if (tier === 'VIP Vang') {
    return 'bg-[#e4e3db] text-[#414942]'
  }

  return 'bg-[#f0eee6] text-[#414942]'
}

function avatarClass(tier) {
  if (tier === 'VIP Kim Cuong') {
    return 'bg-[#fec25b] text-[#744f00]'
  }

  if (tier === 'VIP Vang') {
    return 'bg-[#9ed3ad] text-[#00210f]'
  }

  return 'bg-[#ceebc1] text-[#0a2007]'
}

function ReportsCustomersPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Báo cáo khách hàng"
        description="Xuất và phân tích dữ liệu khách hàng, hạng thành viên và chi tiêu"
        searchPlaceholder="Tim kiem bao cao hoac khach hang..."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#c1c9c0]/30 bg-white p-3 shadow-sm">
        <Link to="/reports" className="rounded-full bg-[#eae8e0] px-4 py-2 text-xs font-semibold text-[#414942]">
          Tong quan
        </Link>
        <Link to="/reports/customers" className="rounded-full bg-[#356647] px-4 py-2 text-xs font-semibold text-white">
          Khach hang
        </Link>
      </div>

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="md:col-span-2 rounded-xl bg-[#ffffff] p-5 shadow-sm">
            <nav className="mb-2 flex items-center gap-2 text-xs text-[#717971]">
              <span>Bao cao</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span>Du lieu khach hang</span>
            </nav>
            <h1 className="text-3xl font-bold text-[#356647]">Xuat bao cao Khach hang</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#414942]">
              Tai ve du lieu khach hang chi tiet voi day du thong tin ve chi tieu, hang thanh vien va thoi gian gan bo.
            </p>
          </article>

          <article className="rounded-xl bg-[#627b59] p-5 text-[#f8ffef] shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <span className="material-symbols-outlined text-3xl">group_add</span>
              <span className="rounded-full bg-[#4a6242] px-2 py-1 text-[10px] font-bold uppercase">Thang nay</span>
            </div>
            <p className="text-3xl font-bold">+1,284</p>
            <p className="text-xs opacity-85">Khach hang moi gia nhap</p>
          </article>
        </div>

        <section className="mb-6 rounded-xl border border-[#e4e3db] bg-[#ffffff] p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 text-[#356647]">
            <span className="material-symbols-outlined">filter_list</span>
            <h3 className="text-xl font-semibold text-[#1b1c17]">Bo loc bao cao</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#414942]">Hang thanh vien</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-full border border-[#4a6242] bg-[#4a6242] px-3 py-1.5 text-xs font-semibold text-white">
                  Tat ca
                </button>
                <button type="button" className="rounded-full border border-[#c1c9c0] bg-[#f6f4ec] px-3 py-1.5 text-xs font-semibold text-[#414942]">
                  VIP Kim Cuong
                </button>
                <button type="button" className="rounded-full border border-[#c1c9c0] bg-[#f6f4ec] px-3 py-1.5 text-xs font-semibold text-[#414942]">
                  VIP Vang
                </button>
                <button type="button" className="rounded-full border border-[#c1c9c0] bg-[#f6f4ec] px-3 py-1.5 text-xs font-semibold text-[#414942]">
                  Thanh vien
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#414942]">Thoi gian gia nhap</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">calendar_today</span>
                <input
                  type="text"
                  readOnly
                  value="01/01/2023 - 31/12/2023"
                  className="h-10 w-full rounded-lg border border-[#c1c9c0] bg-[#f6f4ec] pl-10 pr-3 text-sm outline-none focus:ring-1 focus:ring-[#356647]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#414942]">Tong chi tieu (VND)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Tu"
                  className="h-10 w-full rounded-lg border border-[#c1c9c0] bg-[#f6f4ec] px-3 text-sm outline-none focus:ring-1 focus:ring-[#356647]"
                />
                <span className="text-[#717971]">-</span>
                <input
                  type="number"
                  placeholder="Den"
                  className="h-10 w-full rounded-lg border border-[#c1c9c0] bg-[#f6f4ec] px-3 text-sm outline-none focus:ring-1 focus:ring-[#356647]"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#356647] px-4 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Cap nhat xem truoc
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-[#e4e3db] bg-[#ffffff] shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e4e3db] px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7e5700]">table_view</span>
              <h3 className="text-lg font-semibold text-[#1b1c17]">Xem truoc du lieu (50/4,209 ban ghi)</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#717971]">
              <span className="font-semibold">Dinh dang xuat:</span>
              <div className="flex rounded-lg bg-[#f0eee6] p-1">
                <button type="button" className="rounded-md bg-white px-3 py-1.5 font-semibold text-[#356647] shadow-sm">
                  Excel
                </button>
                <button type="button" className="rounded-md px-3 py-1.5 font-semibold text-[#717971]">
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f6f4ec] text-xs uppercase tracking-wide text-[#717971]">
                <tr>
                  <th className="border-b border-[#e4e3db] px-6 py-4 font-semibold">Ma khach hang</th>
                  <th className="border-b border-[#e4e3db] px-6 py-4 font-semibold">Ho va ten</th>
                  <th className="border-b border-[#e4e3db] px-6 py-4 font-semibold">Hang VIP</th>
                  <th className="border-b border-[#e4e3db] px-6 py-4 font-semibold">Ngay gia nhap</th>
                  <th className="border-b border-[#e4e3db] px-6 py-4 font-semibold">Luot mua</th>
                  <th className="border-b border-[#e4e3db] px-6 py-4 text-right font-semibold">Tong chi tieu (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee6]">
                {customerRows.map((row) => (
                  <tr key={row.code} className="transition-colors hover:bg-[#fbf9f1]">
                    <td className="px-6 py-4 text-[#1b1c17]">{row.code}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${avatarClass(row.tier)}`}>
                          {row.initials}
                        </div>
                        <span className="font-medium text-[#1b1c17]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${tierBadgeClass(row.tier)}`}>{row.tier}</span>
                    </td>
                    <td className="px-6 py-4 text-[#414942]">{row.joinedAt}</td>
                    <td className="px-6 py-4 text-[#1b1c17]">{row.orders}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#356647]">{row.spent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 bg-[#f6f4ec] px-5 py-3">
            <p className="text-xs text-[#717971]">Hien thi 4 tren tong so 4,209 khach hang</p>
            <div className="flex gap-2 text-xs">
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c1c9c0] text-[#717971]">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#356647] font-semibold text-white">
                1
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c1c9c0] font-semibold text-[#717971]">
                2
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c1c9c0] font-semibold text-[#717971]">
                3
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c1c9c0] text-[#717971]">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#4e7f5e]/30 bg-white/90 p-4 backdrop-blur md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#4e7f5e] p-2 text-[#f6fff5]">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <div>
              <p className="text-base font-semibold text-[#356647]">San sang xuat du lieu</p>
              <p className="text-xs text-[#717971]">Du lieu duoc bao mat theo tieu chuan POS Harmony</p>
            </div>
          </div>

          <div className="flex w-full gap-3 md:w-auto">
            <button type="button" className="flex-1 rounded-xl border-2 border-[#356647] px-6 py-2.5 text-sm font-semibold text-[#356647] md:flex-none">
              Huy bo
            </button>
            <button type="button" className="flex-1 rounded-xl bg-[#4a6242] px-6 py-2.5 text-sm font-semibold text-white shadow-sm md:flex-none">
              Xac nhan & Tai bao cao
            </button>
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed bottom-0 right-0 -z-10 w-1/3 opacity-5">
        <img
          alt="Tea Culture Background"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHtvBHxcee1t593a9i23EwQv7Sf2n-hbxVXwH653FC3XY2R1nn7tbO0Gu9lxx0Q13zOoXur_NZGxdzxgE_DNHSAgB6iZ9wolUm0QEqqfte278DHu2Yoxk9z_7RB6VOPPbiADMOYaqVSnEZip6Txmz58nkXQTNB0KOdzEDJa_se2AEXVkXi7gUVM_JTnOFTxIiFqAA-URKngkkGapnV40nXXyV863qeNHYCGW8jGBiiRaRCEYaM6-RB0J94WCzGw1PO1BMxBxomL1Gk"
          className="h-auto w-full"
        />
      </div>
    </div>
  )
}

export default ReportsCustomersPage
