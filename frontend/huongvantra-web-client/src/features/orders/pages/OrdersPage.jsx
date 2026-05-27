import { Link } from 'react-router-dom'

const orders = [
  { id: 'HV1028', customer: 'Nguyễn An', initials: 'NA', channel: 'Website', channelClass: 'bg-purple-50 text-purple-600', payment: 'COD', status: 'Đang giao', statusClass: 'bg-amber-50 text-amber-600', total: '860k', highlight: false },
  { id: 'HV1027', customer: 'Trà Quán Sen', initials: 'TS', channel: 'Đại lý', channelClass: 'bg-indigo-50 text-indigo-600', payment: 'Chuyển khoản', status: 'Đóng gói', statusClass: 'bg-blue-50 text-blue-600', total: '4.8tr', highlight: true },
  { id: 'HV1026', customer: 'Minh Hà', initials: 'MH', channel: 'Zalo', channelClass: 'bg-blue-50 text-blue-400', payment: 'COD', status: 'Chờ xác nhận', statusClass: 'bg-slate-100 text-slate-500', total: '520k', highlight: false },
  { id: 'HV1025', customer: 'Khách lẻ', initials: 'KL', channel: 'POS', channelClass: 'bg-emerald-50 text-emerald-600', payment: 'Tiền mặt', status: 'Hoàn tất', statusClass: 'bg-[#b9d4b0]/30 text-[#538463]', total: '310k', highlight: true },
  { id: 'HV1024', customer: 'Phương Linh', initials: 'PL', channel: 'Phone', channelClass: 'bg-orange-50 text-orange-600', payment: 'Chuyển khoản', status: 'Hoàn tất', statusClass: 'bg-[#b9d4b0]/30 text-[#538463]', total: '1.2tr', highlight: false },
]

const stats = [
  { title: 'Doanh thu ngày', value: '12.400.000', suffix: 'VNĐ', accent: true, note: '+12% so với hôm qua' },
  { title: 'Đơn mới', value: '42', suffix: 'Đơn', accent: false, note: '+5 trong giờ qua' },
  { title: 'Kênh hiệu quả', value: 'Website', suffix: '', accent: false, note: 'Chiếm 45% tổng doanh thu', withIcon: true },
  { title: 'Tồn kho thấp', value: '08', suffix: 'Sản phẩm', accent: false, note: 'Xem danh sách cần nhập', warning: true },
]

function OrdersPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fbf9f1] p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Đơn hàng đa kênh</h1>
          <p className="mt-1 text-slate-500">Quản lý đơn từ POS, Website, Zalo, điện thoại và đại lý</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              className="w-80 rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm shadow-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/20"
              placeholder="Tìm kiếm đơn hàng, sản phẩm..."
              type="text"
            />
            <div className="absolute right-3 top-2.5 text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-[#538463]/20 bg-[#b6d4b8]/40 px-4 py-2.5 text-sm font-semibold text-[#538463]">
            0968.567.433
          </div>
        </div>
      </header>

      <div className="mb-8 flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <button type="button" className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-[#538463]/20">
          Tất cả
        </button>
        <button type="button" className="rounded-xl bg-[#f6f4ec] px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200">
          Hôm nay
        </button>
        <button type="button" className="rounded-xl bg-[#f6f4ec] px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200">
          Theo kênh
        </button>
        <button type="button" className="rounded-xl bg-[#f6f4ec] px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200">
          Trạng thái
        </button>
        <div className="ml-auto">
          <Link className="inline-flex items-center gap-2 rounded-xl bg-[#b6d4b8] px-5 py-2.5 text-sm font-bold text-[#538463] transition-colors hover:bg-[#a7c9aa]" to="/orders/create">
            <span className="text-xl leading-none">+</span>
            Tạo mới
          </Link>
        </div>
      </div>

      <section className="min-h-[500px] overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">Danh sách đơn hàng</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Khách hàng</th>
                <th className="px-4 py-4 text-center">Kênh</th>
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-8 py-4 text-right">Tổng tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((order) => (
                <tr key={order.id} className={`transition-colors hover:bg-[#fbf9f1]/30 ${order.highlight ? 'bg-[#fbf9f1]/10' : ''}`}>
                  <td className="px-8 py-5 font-bold text-slate-700">
                    <Link className="hover:text-[#538463] hover:underline" to={`/orders/${order.id}`}>
                      #{order.id}
                    </Link>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {order.initials}
                      </div>
                      <span className="font-medium text-slate-800">{order.customer}</span>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.channelClass}`}>{order.channel}</span>
                  </td>
                  <td className="px-4 py-5 text-slate-600">{order.payment}</td>
                  <td className="px-4 py-5">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.statusClass}`}>{order.status}</span>
                  </td>
                  <td className="px-8 py-5 text-right font-bold text-slate-800">{order.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className={`rounded-3xl p-6 shadow-sm ${stat.accent ? 'bg-[#538463] text-white shadow-[#538463]/20' : stat.warning ? 'border border-amber-100 bg-amber-50 text-amber-800' : 'border border-slate-100 bg-white'}`}
          >
            <p className={`text-sm font-medium ${stat.accent ? 'text-white/70' : stat.warning ? 'text-amber-700' : 'text-slate-500'}`}>{stat.title}</p>

            <div className="mt-2 flex items-baseline gap-2">
              <h3 className={`text-2xl font-bold ${stat.accent ? 'text-white' : 'text-slate-800'}`}>{stat.value}</h3>
              {stat.suffix ? <span className={`text-xs font-bold ${stat.accent ? 'text-[#b6d4b8]' : stat.warning ? 'text-amber-700/70' : 'text-slate-400'}`}>{stat.suffix}</span> : null}
            </div>

            {stat.withIcon ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50">
                  <div className="h-4 w-4 rounded-sm bg-purple-600" />
                </div>
                <span className={`text-xl font-bold ${stat.accent ? 'text-white' : 'text-slate-800'}`}>{stat.value}</span>
              </div>
            ) : null}

            <div className={`mt-4 text-xs font-medium ${stat.accent ? 'text-white/80' : stat.warning ? 'text-amber-700' : 'text-slate-400'}`}>
              {stat.note}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default OrdersPage