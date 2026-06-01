import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const stockRows = [
  { code: 'KHO-01', product: 'Hồng Trà 100g', batch: 'Lô A05', expiry: '05/2027', stock: '86', alert: 'Ổn định', accent: 'text-gray-600' },
  { code: 'KHO-01', product: 'Kẹo Trà', batch: 'Lô K12', expiry: '12/2026', stock: '12', alert: 'Tồn thấp', accent: 'text-amber-600' },
  { code: 'KHO-01', product: 'Trà Đỉnh', batch: 'Lô D02', expiry: '02/2028', stock: '8', alert: 'Giá trị cao', accent: 'text-indigo-600' },
  { code: 'KHO-02', product: 'Túi Gấm', batch: 'Không áp dụng', expiry: '—', stock: '5', alert: 'Cần nhập', accent: 'text-red-600', batchItalic: true },
]

function InventoryStockPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Kho &amp; tồn hàng"
        description="Theo dõi tồn kho, lô hàng, hạn dùng và nhập xuất"
        searchPlaceholder="Tìm kiếm đơn hàng, sản phẩm..."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-lg bg-[#446e52] px-5 py-2 text-sm font-medium text-white">
            Tất cả
          </button>
          <button type="button" className="rounded-lg bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[#c3dbbc]/50">
            Hôm nay
          </button>
          <button type="button" className="rounded-lg bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[#c3dbbc]/50">
            Theo kênh
          </button>
          <button type="button" className="rounded-lg bg-[#c3dbbc]/30 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[#c3dbbc]/50">
            Trạng thái
          </button>
        </div>

        <Link to="/inventory/bom" className="flex items-center rounded-lg bg-[#c3dbbc] px-5 py-2 text-sm font-bold text-[#446e52]">
          <span className="mr-1.5">+</span> Tao moi BOM
        </Link>
      </div>

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