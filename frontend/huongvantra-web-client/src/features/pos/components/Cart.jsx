function Cart({ items, total, onAddCustomerClick, onAddOfferClick }) {
  return (
    <aside className="flex w-full min-w-0 flex-col rounded-[24px] border border-gray-100 bg-white p-4 shadow-xl ring-1 ring-black/5 sm:p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:w-[clamp(320px,28vw,390px)] xl:flex-none xl:self-start xl:overflow-hidden xl:p-6">
      <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold sm:text-xl">Giỏ hàng</h3>
          <button type="button" className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Thêm khách hàng"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onAddCustomerClick()
            }
          }}
          className="flex cursor-pointer items-center justify-center rounded-full bg-black p-2 text-white transition hover:bg-black/80"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              onClick={onAddCustomerClick}
              className="cursor-pointer"
            />
          </svg>
        </div>
      </div>

      <div className="relative mb-5 sm:mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm khách hàng...."
          className="w-full rounded-xl border-none bg-gray-50 py-3 pl-10 pr-10 text-sm focus:ring-[#B5D5B0]"
        />
        <button
          type="button"
          aria-label="Thêm khách hàng"
          onClick={onAddCustomerClick}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-800 transition hover:text-gray-600"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </div>

      <div className="mb-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:mb-6">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#FCFAF2] p-4 sm:p-5">
            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{item.name}</p>
            <p className="shrink-0 text-sm font-bold">{item.price}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-4 border-t border-gray-100 pt-4 sm:pt-5">
        <div className="mb-2">
          <button
            type="button"
            onClick={onAddOfferClick}
            className="w-full rounded-full border border-[#B5D5B0] bg-white px-4 py-3 text-sm font-semibold text-[#4B7C5C] shadow-sm transition hover:bg-[#F4FAF2]"
          >
            Tùy chỉnh ưu đãi
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold sm:text-2xl">Tổng thanh toán:</span>
          <span className="text-lg font-extrabold sm:text-2xl">{total}</span>
        </div>
        <button
          type="button"
          className="w-full rounded-2xl bg-[#B5D5B0] py-4 text-base font-bold text-gray-800 transition-opacity hover:opacity-90 sm:py-5 sm:text-xl"
        >
          Thanh toán &amp; in hóa đơn
        </button>
      </div>
    </aside>
  )
}

export default Cart