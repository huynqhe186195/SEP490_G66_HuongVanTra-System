function QuickOrderPage() {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 pb-4 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pb-6 sm:pt-4">
        <div data-purpose="page-title">
          <h1 className="text-2xl font-extrabold text-gray-800 sm:text-3xl">Tạo đơn nhanh Zalo/Phone</h1>
          <p className="mt-1 text-sm text-gray-500">Nhập đơn tư vấn nhanh, chọn giao hàng và COD/chuyển khoản</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <input
              className="h-11 w-full rounded-xl border-0 px-4 text-sm shadow-sm ring-1 ring-inset ring-gray-100 focus:ring-2 focus:ring-[#538463] sm:h-12 sm:w-64"
              placeholder="Tìm kiếm nhanh..."
              type="text"
            />
          </div>
          <button type="button" className="rounded-xl bg-[#b5d6bc] px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-[#a4c9ac]">
            Lưu nháp
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pb-2 lg:flex-row lg:gap-8">
        <section className="h-fit rounded-[24px] bg-white p-4 shadow-sm sm:p-6 lg:flex-[2] lg:p-8" data-purpose="order-info-section">
          <h2 className="mb-6 text-xl font-bold text-gray-800">Thông tin đơn hàng</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Khách hàng</label>
              <div className="font-medium text-gray-800">Nguyễn Minh Anh</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Số điện thoại</label>
              <div className="font-medium text-gray-800">0988 698 311</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Kênh bán</label>
              <div className="font-medium text-gray-800">Zalo</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Sản phẩm</label>
              <div className="font-medium text-gray-800">Hồng Trà 100g x2</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Phí giao hàng</label>
              <div className="font-medium text-gray-800">30.000đ</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Thanh toán</label>
              <div className="font-medium text-gray-800">COD</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5 sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Ghi chú tư vấn</label>
              <div className="font-medium text-gray-800">Tặng quà sinh nhật, cần hộp đẹp</div>
            </div>
          </div>
        </section>

        <section className="h-fit flex-1 rounded-[24px] bg-white p-4 shadow-sm sm:p-6 lg:p-8" data-purpose="payment-summary-section">
          <h2 className="mb-6 text-xl font-bold text-gray-800">Tóm tắt thanh toán</h2>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Tạm tính</label>
              <div className="font-bold text-gray-800">360.000đ</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Giảm giá</label>
              <div className="font-bold text-gray-800">0đ</div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Tổng cộng</label>
              <div className="text-xl font-extrabold text-gray-900">390.000đ</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default QuickOrderPage