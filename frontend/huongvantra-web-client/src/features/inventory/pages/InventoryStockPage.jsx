import { Link } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'

function InventoryStockPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl rounded-[1.5rem] border border-dashed border-[#c1c9c0] bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0eee6] text-[#356647]">
          <span className="material-symbols-outlined text-[32px]">warehouse</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">Kho tổng</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Module quản lý kho trung tâm (cung cấp hàng cho các chuỗi cửa hàng) đang được phát triển.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Hiện tại, <strong>số lượng hiện tại</strong> tại cửa hàng được quản lý trong mục Sản phẩm — tại từng SKU.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          Đi tới Sản phẩm &amp; số lượng hiện tại
        </Link>
      </div>
    </PageShell>
  )
}

export default InventoryStockPage
