import { Link, useParams } from 'react-router-dom'

function ProductFormPage({ mode }) {
  const { id } = useParams()
  const isEditMode = mode === 'edit' || Boolean(id)

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">{isEditMode ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý ảnh, mô tả, biến thể, giá và trạng thái kinh doanh</p>
        </div>

        <div className="flex items-center gap-3">
          <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" to="/products">
            Quay lại
          </Link>
          <button type="button" className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#457053]">
            {isEditMode ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-8 space-y-6">
          <div className="rounded-[1rem] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin sản phẩm</h2>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên sản phẩm</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue={isEditMode ? 'Hồng Trà Hương Vân' : ''} />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Danh mục</label>
                <select className="w-full appearance-none border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" defaultValue="Trà móc câu">
                  <option>Trà móc câu</option>
                  <option>Trà Oolong</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue={isEditMode ? id ?? 'TRA-HONG-100' : ''} />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng thái</label>
                <select className="w-full appearance-none border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" defaultValue="Đang bán">
                  <option>Đang bán</option>
                  <option>Ngừng kinh doanh</option>
                </select>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mô tả</label>
              <textarea className="h-12 w-full resize-none border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" defaultValue={isEditMode ? 'Trà thơm nhẹ, phù hợp dùng hằng ngày' : ''} />
            </div>

            <div className="mb-8 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hướng dẫn bảo quản</label>
              <textarea className="h-12 w-full resize-none border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" defaultValue="Để nơi khô ráo, tránh ánh nắng" />
            </div>
          </div>
        </section>

        <section className="col-span-12 xl:col-span-4">
          <div className="rounded-[1rem] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-slate-800">Biến thể &amp; giá</h2>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy cách</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue="100g" />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Giá lẻ</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue="180.000đ" />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Giá đại lý</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue="145.000đ" />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tồn tối thiểu</label>
                <input className="w-full border-none bg-transparent p-0 font-semibold text-slate-700 focus:ring-0" type="text" defaultValue="20" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default ProductFormPage
