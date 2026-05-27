function InventoryImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-[#F1EAD7] bg-[#FFFCEF] p-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Nhập kho</h1>
          <p className="mt-1 text-xs text-gray-500">Tạo phiếu nhập từ nhà cung cấp, theo lô và hạn sử dụng</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            <input
              className="w-full rounded-xl border-none py-2.5 pl-4 pr-10 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-primary sm:w-64"
              placeholder="Tìm kiếm nhanh..."
              type="text"
            />
          </div>

          <button type="button" className="rounded-xl bg-[#B7D4B2] px-6 py-2.5 text-sm font-semibold text-[#4A6348] transition-all hover:brightness-95">
            Lưu nháp
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
          <h2 className="mb-6 text-lg font-bold">Phiếu nhập kho</h2>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {[
              ['Nhà cung cấp', 'HTX Tân Cương'],
              ['Kho nhận', 'Kho chính'],
              ['Ngày nhập', '14/05/2026'],
              ['Sản phẩm', 'Hồng Trà 100g'],
              ['Lô hàng', 'Lô A05'],
              ['Hạn sử dụng', '05/2027'],
              ['Số lượng', '200 gói'],
              ['Giá vốn', '95.000đ/gói'],
            ].map(([label, value]) => (
              <div key={label} className="input-card rounded-xl p-3.5">
                <label className="text-[10px] font-semibold uppercase text-gray-400">{label}</label>
                <input className="mt-0.5 w-full border-none p-0 text-sm font-medium text-gray-800 focus:ring-0" type="text" defaultValue={value} />
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-lg font-bold">Kiểm tra</h2>

          <div className="space-y-4">
            <div className="input-card rounded-xl p-4">
              <label className="text-[10px] font-semibold uppercase text-gray-400">Tổng nhập</label>
              <span className="mt-1 block text-lg font-bold text-gray-800">200</span>
            </div>

            <div className="input-card rounded-xl p-4">
              <label className="text-[10px] font-semibold uppercase text-gray-400">Tồn sau nhập</label>
              <span className="mt-1 block text-lg font-bold text-gray-800">286</span>
            </div>

            <div className="input-card rounded-xl p-4">
              <label className="text-[10px] font-semibold uppercase text-gray-400">Trạng thái</label>
              <span className="mt-1 block text-sm font-bold text-gray-800">Chờ duyệt</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default InventoryImportPage