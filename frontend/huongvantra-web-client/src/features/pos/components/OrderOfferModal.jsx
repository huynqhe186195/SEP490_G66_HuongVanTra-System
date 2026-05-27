function OrderOfferModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <main
        className="flex w-full max-w-[750px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
          <h1 className="text-lg font-semibold text-gray-800 sm:text-xl">Tùy chỉnh Ưu đãi Đơn hàng</h1>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </header>

        <div className="max-h-[calc(100vh-10rem)] space-y-6 overflow-y-auto p-5 sm:p-6">
          <section>
            <label className="mb-3 block text-sm font-semibold text-gray-700">Phân loại khách hàng</label>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-full border border-[#6d8c71] bg-[#6d8c71] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-95">
                Khách Phổ thông
              </button>
              <button type="button" className="rounded-full border border-gray-100 bg-white px-5 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-50">
                Khách Đối ngoại
              </button>
              <button type="button" className="rounded-full border border-gray-100 bg-white px-5 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-50">
                Khách doanh nghiệp
              </button>
            </div>
          </section>

          <section>
            <label className="mb-3 block text-sm font-semibold text-gray-700">Chiết khấu thủ công</label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative">
                <select className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm text-gray-500 outline-none transition focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15">
                  <option>Chiết khấu %</option>
                  <option>5%</option>
                  <option>10%</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path clipRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" fillRule="evenodd" />
                  </svg>
                </div>
              </div>
              <input
                className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
                placeholder="Giảm trực tiếp VNĐ"
                type="text"
              />
            </div>
          </section>

          <section>
            <label className="mb-3 block text-sm font-semibold text-gray-700">Thêm quà tặng</label>
            <div className="flex gap-3">
              <div className="relative min-w-0 flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <input
                  className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
                  placeholder="Tìm kiếm quà tặng..."
                  type="text"
                />
              </div>
              <button type="button" className="h-12 rounded-xl bg-[#6d8c71] px-5 text-sm font-medium text-white transition hover:bg-[#538463]">
                Thêm
              </button>
            </div>
          </section>

          <section>
            <label className="mb-3 block text-sm font-semibold text-gray-700">Địa chỉ giao hàng</label>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#6d8c71] px-5 py-2.5 text-white transition hover:bg-[#538463]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span className="font-medium">Thêm địa chỉ</span>
            </button>
          </section>

          <section>
            <label className="mb-3 block text-sm font-semibold text-gray-700">
              Lý do / Ghi chú <span className="text-red-500">*</span>
            </label>
            <textarea
              className="min-h-[140px] w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
              placeholder="Nhập lý do áp dụng chiết khấu (bắt buộc cho kiểm toán nội bộ)..."
              rows="5"
            />
          </section>
        </div>

        <footer className="flex flex-col justify-end gap-3 border-t border-gray-100 p-5 pt-4 sm:flex-row sm:p-6 sm:pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-8 py-3 font-semibold text-gray-700 transition hover:bg-gray-50">
            Hủy
          </button>
          <button type="button" className="rounded-xl bg-[#6d8c71] px-8 py-3 font-semibold text-white shadow-sm transition hover:bg-[#538463]">
            Xác nhận
          </button>
        </footer>
      </main>
    </div>
  )
}

export default OrderOfferModal