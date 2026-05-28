import { Link } from 'react-router-dom'

const stockRows = [
  { code: 'KHO-01', product: 'Hồng Trà 100g', batch: 'Lô A05', expiry: '05/2027', stock: '86', alert: 'Ổn định', accent: 'text-gray-600' },
  { code: 'KHO-01', product: 'Kẹo Trà', batch: 'Lô K12', expiry: '12/2026', stock: '12', alert: 'Tồn thấp', accent: 'text-amber-600' },
  { code: 'KHO-01', product: 'Trà Đỉnh', batch: 'Lô D02', expiry: '02/2028', stock: '8', alert: 'Giá trị cao', accent: 'text-indigo-600' },
  { code: 'KHO-02', product: 'Túi Gấm', batch: 'Không áp dụng', expiry: '—', stock: '5', alert: 'Cần nhập', accent: 'text-red-600', batchItalic: true },
]

function InventoryStockPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="rounded-[24px] border border-gray-200 bg-[#fefcf3] px-8 py-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Kho &amp; tồn hàng</h1>
            <p className="mt-1 text-sm text-gray-500">Theo dõi tồn kho, lô hàng, hạn dùng và nhập xuất</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                className="w-full rounded-xl border-none bg-white py-2 pl-4 pr-10 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-[#538463] sm:w-64"
                placeholder="Tìm kiếm đơn hàng, sản phẩm..."
                type="text"
              />
            </div>
            <div className="rounded-lg bg-[#c3dbbc]/40 px-4 py-2 text-sm font-bold text-[#446e52]">0968.567.433</div>
          </div>
        </div>

        <section className="mt-5">
          <div className="flex items-center space-x-3">
            <button type="button" className="bg-[#446e52] px-5 py-2 text-sm font-medium text-white rounded-lg">
              Tất cả
            </button>
            <button type="button" className="bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 rounded-lg transition-colors hover:bg-[#c3dbbc]/50">
              Hôm nay
            </button>
            <button type="button" className="bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 rounded-lg transition-colors hover:bg-[#c3dbbc]/50">
              Theo kênh
            </button>
            <button type="button" className="bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 rounded-lg transition-colors hover:bg-[#c3dbbc]/50">
              Trạng thái
            </button>
            <Link to="/inventory/bom" className="ml-auto flex items-center rounded-lg bg-[#c3dbbc] px-5 py-2 text-sm font-bold text-[#446e52]">
              <span className="mr-1.5">+</span> Tao moi BOM
            </Link>
          </div>
        </section>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-800">Kho &amp; tồn hàng</h2>
        </div>

        <div className="overflow-auto px-6 py-4">
          <table className="w-full border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="bg-[#fefcf3] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="rounded-l-xl px-6 py-4">Mã kho</th>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">Lô</th>
                <th className="px-6 py-4">Hạn dùng</th>
                <th className="px-6 py-4">Tồn</th>
                <th className="rounded-r-xl px-6 py-4">Cảnh báo</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {stockRows.map((row, index) => (
                <tr key={`${row.code}-${row.product}`} className={`${index % 2 === 0 ? 'bg-[#fefcf3]/50' : ''} transition-colors hover:bg-gray-50`}>
                  <td className="rounded-l-xl px-6 py-4 font-bold text-gray-800">{row.code}</td>
                  <td className="px-6 py-4 text-gray-600">{row.product}</td>
                  <td className={`px-6 py-4 text-gray-600 ${row.batchItalic ? 'italic' : ''}`}>{row.batch}</td>
                  <td className="px-6 py-4 text-gray-600">{row.expiry}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{row.stock}</td>
                  <td className={`rounded-r-xl px-6 py-4 font-medium ${row.accent}`}>{row.alert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default InventoryStockPage