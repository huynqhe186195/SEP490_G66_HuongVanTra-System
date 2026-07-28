function InventoryDeductionModal({ isOpen, onClose, order, date, product, materials = [] }) {
  if (!isOpen) return null

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[min(1010px,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl md:rounded-xl" onClick={(event) => event.stopPropagation()}>
        <header className="relative border-b border-gray-100 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight text-gray-900">Đơn hàng {order}</h1>
            <button type="button" aria-label="Đóng popup" onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              Ngày: {date}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              Sản phẩm: {product}
            </div>
          </div>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#F9FAF7] p-5">
          <h2 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-gray-500">Nguyên liệu yêu cầu vs kho</h2>

          <div className="space-y-4">
            {materials.map((material) => (
              <div
                key={material.name}
                className={`rounded-xl border p-4 transition-all ${material.status === 'ok' ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50/30'}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900">{material.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      material.status === 'ok'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-100 text-red-700'
                    }`}
                  >
                    {material.status === 'ok' ? (
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                          clipRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          fillRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                          clipRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          fillRule="evenodd"
                        />
                      </svg>
                    )}
                    {material.statusLabel}
                  </span>
                </div>

                <div className="flex gap-4 text-sm">
                  <p className="text-gray-500">
                    Yêu cầu: <span className="font-medium text-gray-900">{material.required}</span>
                  </p>
                  <p className={material.status === 'ok' ? 'text-gray-500' : 'font-semibold text-red-600'}>
                    Tồn kho: <span className="font-medium text-gray-900">{material.stock}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center py-20 opacity-10">
            <svg className="h-12 w-12 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <div className="h-24" />
            <svg className="h-12 w-12 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
        </main>

        <footer className="space-y-6 border-t border-gray-100 bg-[#F9FAF7] p-5">
          <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-4 py-3.5 font-semibold text-gray-500">
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            Không thể Khấu trừ
          </button>

          <div className="relative flex items-center justify-center">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative bg-[#F9FAF7] px-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">HODC (TRẠNG THÁI HOẠT ĐỘNG)</span>
            </div>
          </div>

          <button type="button" className="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-[#456d52] active:scale-[0.98]">
            <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                clipRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                fillRule="evenodd"
              />
            </svg>
            Xác nhận Khấu trừ Nguyên liệu
          </button>
        </footer>
      </div>
    </div>
  )
}

export default InventoryDeductionModal