import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const products = [
  { id: 'HV-100', name: 'Hồng Trà Hương Vân', category: 'Trà móc câu', price: '180.000đ', stock: '42', status: 'Đang bán' },
  { id: 'OV-220', name: 'Ô Long Cổ Thụ', category: 'Trà Oolong', price: '260.000đ', stock: '18', status: 'Đang bán' },
  { id: 'XG-045', name: 'Trà Xanh Gói Nhỏ', category: 'Trà xanh', price: '95.000đ', stock: '0', status: 'Ngừng kinh doanh' },
]

function ProductsListPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto sm:gap-6">
      <PageHeader
        title="Sản phẩm"
        description="Quản lý danh sách sản phẩm, trạng thái và giá bán"
        searchPlaceholder="Tìm sản phẩm..."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="text-sm font-medium text-slate-500">Bộ lọc và thao tác sản phẩm</div>
        <div className="flex items-center gap-3">
          <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50" to="/products/pricing">
            Danh mục &amp; bảng giá
          </Link>
          <Link className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#457053]" to="/products/create">
            Tạo mới
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-4 font-semibold">SKU</th>
              <th className="px-6 py-4 font-semibold">Tên sản phẩm</th>
              <th className="px-6 py-4 font-semibold">Danh mục</th>
              <th className="px-6 py-4 font-semibold">Giá</th>
              <th className="px-6 py-4 font-semibold">Tồn kho</th>
              <th className="px-6 py-4 font-semibold">Trạng thái</th>
              <th className="px-6 py-4 font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 font-medium text-slate-900">{product.id}</td>
                <td className="px-6 py-4">{product.name}</td>
                <td className="px-6 py-4">{product.category}</td>
                <td className="px-6 py-4">{product.price}</td>
                <td className="px-6 py-4">{product.stock}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.status === 'Đang bán' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Link className="font-medium text-[#538463] hover:underline" to={`/products/${product.id}/edit`}>
                      Sửa
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProductsListPage
