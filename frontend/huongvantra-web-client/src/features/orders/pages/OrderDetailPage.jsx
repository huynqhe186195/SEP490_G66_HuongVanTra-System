import { Link, useParams } from 'react-router-dom'

const timelineItems = [
  { time: '10:02', title: 'Tạo đơn từ website', active: false },
  { time: '10:10', title: 'Xác nhận đơn', active: false },
  { time: '11:00', title: 'Đóng gói', active: false },
  { time: '14:30', title: 'Đang giao', active: true },
]

function OrderDetailPage() {
  const { id } = useParams()

  return (
    <main className="flex h-full flex-1 flex-col overflow-y-auto p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Chi tiết đơn hàng #{id ?? 'HV1028'}</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi sản phẩm, thanh toán, giao hàng và lịch sử xử lý</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/20"
              placeholder="Tìm kiếm nhanh..."
              type="text"
            />
          </div>
          <button type="button" className="rounded-xl bg-[#b9d4b0] px-5 py-2.5 text-sm font-bold text-[#1a1a1a] shadow-sm transition-colors hover:opacity-90">
            Lưu nháp
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-[1.5rem] bg-white p-8 shadow-sm lg:col-span-2">
          <h2 className="mb-6 text-xl font-extrabold text-slate-800">Thông tin &amp; sản phẩm</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mã đơn</span>
              <p className="mt-1 text-base font-semibold text-slate-800">#{id ?? 'HV1028'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Khách hàng</span>
              <p className="mt-1 text-base font-semibold text-slate-800">Nguyễn An</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kênh</span>
              <p className="mt-1 text-base font-semibold text-slate-800">Website</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Trạng thái</span>
              <p className="mt-1 text-base font-semibold text-slate-800">Đang giao</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sản phẩm</span>
              <p className="mt-1 text-base font-semibold text-slate-800">Trà Ướp Hoa Bưởi x2</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Thanh toán</span>
              <p className="mt-1 text-base font-semibold text-slate-800">COD - thanh toán khi nhận hàng</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Địa chỉ giao</span>
              <p className="mt-1 text-base font-semibold text-slate-800">Phường Phan Đình Phùng, Thái Nguyên</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50" to="/orders">
              Quay lại danh sách
            </Link>
            <Link className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#457053]" to="/orders/create">
              Tạo đơn nhanh
            </Link>
          </div>
        </section>

        <section className="rounded-[1.5rem] bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-extrabold text-slate-800">Timeline xử lý</h2>

          <div className="space-y-4">
            {timelineItems.map((item) => (
              <div key={item.time} className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{item.time}</span>
                <p className={`mt-1 text-sm font-semibold ${item.active ? 'text-[#538463]' : 'text-slate-800'}`}>{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default OrderDetailPage