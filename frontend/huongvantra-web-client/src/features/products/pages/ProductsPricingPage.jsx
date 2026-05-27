import { Link } from 'react-router-dom'

const categoryCards = [
  { name: 'Trà xanh', count: '17 sản phẩm' },
  { name: 'Trà móc câu', count: '14 sản phẩm' },
  { name: 'Kẹo trà', count: '4 sản phẩm' },
  { name: 'Dụng cụ trà', count: '22 sản phẩm' },
  { name: 'Set quà', count: '17 sản phẩm' },
]

const pricingRules = [
  { label: 'Giá POS', value: 'Theo giá lẻ' },
  { label: 'Giá Website', value: 'Theo khuyến mãi' },
  { label: 'Giá Đại lý', value: 'Chiết khấu 12%' },
  { label: 'Hiệu lực', value: '01/05/2026' },
]

function ProductsPricingPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
      <header className="mb-8 flex items-start justify-between gap-4" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Danh mục &amp; bảng giá</h1>
          <p className="mt-1 text-sm text-gray-500">Cây danh mục, quy tắc giá lẻ, giá đại lý và giá theo kênh</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative w-80">
            <input
              className="w-full rounded-xl border-none bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-black/5 focus:ring-[#538463]"
              placeholder="Tìm kiếm nhanh..."
              type="text"
            />
          </div>
          <Link className="rounded-xl bg-[#a3c4ae]/40 px-6 py-2 text-sm font-semibold text-[#3e634a] transition hover:bg-[#a3c4ae]/60" to="/products/create">
            Lưu nháp
          </Link>
        </div>
      </header>

      <div className="flex flex-1 gap-8 overflow-y-auto pb-6">
        <section className="flex-[3] rounded-[1rem] bg-white p-8 shadow-sm" data-purpose="category-tree">
          <h2 className="mb-6 text-lg font-bold text-gray-800">Cây danh mục</h2>

          <div className="grid grid-cols-2 content-start gap-4">
            {categoryCards.map((item) => (
              <div key={item.name} className="cursor-pointer rounded-xl border border-gray-100 p-5 transition hover:border-[#538463]/30">
                <span className="text-xs font-medium text-gray-400">{item.name}</span>
                <p className="mt-1 text-base font-bold text-gray-700">{item.count}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button type="button" className="flex items-center space-x-2 rounded-xl bg-[#538463] px-8 py-3 font-medium text-white shadow-md transition hover:bg-[#3e634a]">
              <span className="text-xl">+</span>
              <span>Thêm danh mục</span>
            </button>
          </div>
        </section>

        <section className="flex-[1.5] rounded-[1rem] bg-white p-8 shadow-sm" data-purpose="pricing-rules">
          <h2 className="mb-6 text-lg font-bold text-gray-800">Quy tắc bảng giá</h2>

          <div className="space-y-4">
            {pricingRules.map((rule) => (
              <div key={rule.label} className="rounded-xl border border-gray-100 p-5">
                <span className="text-xs font-medium text-gray-400">{rule.label}</span>
                <p className="mt-1 text-base font-bold text-gray-700">{rule.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default ProductsPricingPage
