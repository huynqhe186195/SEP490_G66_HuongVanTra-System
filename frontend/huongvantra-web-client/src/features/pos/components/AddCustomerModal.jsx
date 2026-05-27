function AddCustomerModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between bg-[#538463] px-5 py-4 text-white sm:px-6">
          <h1 className="text-lg font-bold tracking-wide sm:text-xl">THÊM MỚI KHÁCH HÀNG</h1>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 transition hover:bg-white/10">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </header>

        <main className="grid max-h-[calc(100vh-9rem)] grid-cols-1 gap-6 overflow-y-auto bg-[#fbf9f1] p-5 md:grid-cols-12 md:p-6">
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm md:col-span-7 md:p-6">
            <h2 className="mb-5 border-b border-gray-100 pb-3 text-lg font-semibold text-[#8b6e4b]">Thông tin nhận diện</h2>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Số điện thoại<span className="text-red-500">*</span></label>
                <div className="relative">
                  <input className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#538463] focus:ring-4 focus:ring-[#538463]/15" placeholder="Nhập số điện thoại..." type="text" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#538463]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Tên khách hàng<span className="text-red-500">*</span></label>
                <input className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#538463] focus:ring-4 focus:ring-[#538463]/15" placeholder="Nhập họ và tên..." type="text" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Địa chỉ <span className="text-red-500">*</span></label>
                <input className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#538463] focus:ring-4 focus:ring-[#538463]/15" placeholder="Nhập địa chỉ..." type="text" />
              </div>

              <div className="mt-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">Nhóm khách hàng<span className="text-red-500">*</span></label>
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="inline-flex cursor-pointer items-center">
                    <input checked className="h-5 w-5 border-gray-300 text-[#538463] focus:ring-[#538463]" name="customer-group" type="radio" readOnly />
                    <span className="ml-2 text-sm text-gray-800">Phổ thông</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center">
                    <input className="h-5 w-5 border-gray-300 text-[#538463] focus:ring-[#538463]" name="customer-group" type="radio" />
                    <span className="ml-2 text-sm text-gray-800">Doanh nghiệp</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center">
                    <input className="h-5 w-5 border-gray-300 text-[#538463] focus:ring-[#538463]" name="customer-group" type="radio" />
                    <span className="ml-2 text-sm text-gray-800">Đối ngoại (VIP)</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm md:col-span-5 md:p-6">
            <h2 className="mb-5 border-b border-gray-100 pb-3 text-lg font-semibold text-[#8b6e4b]">Quản lý &amp; Phân bổ</h2>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Người phụ trách<span className="text-red-500">*</span></label>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#538463] focus:ring-4 focus:ring-[#538463]/15">
                  <option>Nguyễn Văn A - Sale</option>
                  <option>Trần Thị B - Admin</option>
                </select>
                <p className="mt-1 text-[11px] italic text-gray-400">*Hệ thống tự động gán cho Sale tạo. Admin có thể thay đổi.</p>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Ghi chú thêm</label>
                <textarea className="min-h-[180px] w-full resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#538463] focus:ring-4 focus:ring-[#538463]/15" placeholder="Nhập sở thích, thói quen uống trà của khách..." rows="5" />
              </div>
            </div>
          </section>
        </main>

        <footer className="flex flex-col items-center justify-end gap-3 border-t border-[#e5e7eb] bg-white px-5 py-4 sm:flex-row sm:px-6">
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-[#e5e7eb] px-8 py-3 font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto">
            Hủy bỏ
          </button>
          <button type="button" className="w-full rounded-lg bg-[#538463] px-6 py-3 font-medium text-white shadow-sm transition hover:bg-[#436b50] sm:w-auto">
            Lưu &amp; Lên đơn ngay
          </button>
          <button type="button" className="w-full rounded-lg bg-[#538463] px-8 py-3 font-medium text-white shadow-sm transition hover:bg-[#436b50] sm:w-auto">
            Lưu thông tin
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AddCustomerModal