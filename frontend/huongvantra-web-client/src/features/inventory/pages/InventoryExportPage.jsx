import { NavLink } from 'react-router-dom'

const navigationTabs = [
  { label: 'Nhập kho', to: '/inventory' },
  { label: 'Xuất kho', to: '/inventory/export' },
]

const logItems = [
  { time: '14:30', text: 'Xuất 2 hộp cho #HV1028' },
  { time: '11:20', text: 'Điều chỉnh +5 do kiểm kê', accent: '+5' },
  { time: '09:10', text: 'Nhập 200 gói lô A05' },
]

function InventoryExportPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-[#f0eee4] bg-[#fefefc]/60 p-6 shadow-sm lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Xuất kho &amp; nhật ký kho</h1>
          <p className="mt-1 text-xs text-slate-500">Xuất theo đơn, luân chuyển nội bộ và xem audit tồn kho</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {navigationTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-secondary/70 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>

          <div className="relative">
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm focus:border-primary focus:ring-primary sm:w-64"
              placeholder="Tìm kiếm nhanh..."
              type="text"
            />
          </div>

          <button type="button" className="rounded-lg bg-secondary/70 px-6 py-2 text-sm font-bold text-slate-800 transition-all hover:bg-secondary">
            Lưu nháp
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl-custom border border-slate-100 bg-white p-8 shadow-sm lg:col-span-8">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Phiếu xuất kho</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Loại xuất</label>
              <div className="text-sm font-medium text-slate-700">Theo đơn hàng</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mã đơn</label>
              <div className="text-sm font-medium text-slate-700">#HV1028</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sản phẩm</label>
              <div className="text-sm font-medium text-slate-700">Trà Ướp Hoa Bưởi</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lô ưu tiên</label>
              <div className="text-sm font-medium text-slate-700">Lô B02 - gần hết hạn</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4 sm:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Số lượng</label>
              <div className="text-sm font-medium text-slate-700">2 hộp</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl-custom border border-slate-100 bg-white p-8 shadow-sm lg:col-span-4">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Nhật ký gần nhất</h2>

          <div className="space-y-4">
            {logItems.map((item) => (
              <div key={`${item.time}-${item.text}`} className="group cursor-pointer rounded-lg border border-slate-200 p-4 transition-colors hover:border-secondary">
                <span className="mb-1 block text-[10px] font-bold text-slate-400 group-hover:text-primary">{item.time}</span>
                <p className="text-sm leading-snug text-slate-700">
                  {item.accent ? (
                    <>
                      Điều chỉnh <span className="font-bold text-emerald-600">{item.accent}</span> do kiểm kê
                    </>
                  ) : (
                    item.text
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default InventoryExportPage