import { useEffect, useState } from 'react'

function parseMoneyInput(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function OrderOfferModal({ isOpen, onClose, onConfirm, initialPercent = 0, initialFixedAmount = 0 }) {
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountFixedInput, setDiscountFixedInput] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setDiscountPercent(initialPercent > 0 ? String(initialPercent) : '')
    setDiscountFixedInput(initialFixedAmount > 0 ? String(initialFixedAmount) : '')
  }, [isOpen, initialPercent, initialFixedAmount])

  if (!isOpen) return null

  const handleConfirm = () => {
    const fixedAmount = parseMoneyInput(discountFixedInput)
    const percent = Math.min(100, Math.max(0, Number(discountPercent) || 0))
    if (onConfirm) {
      onConfirm({ percent, fixedAmount })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <main
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h1 className="text-lg font-semibold text-gray-800">Chiết khấu đơn</h1>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Chiết khấu theo %</label>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm outline-none focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
              value={discountPercent}
              onChange={(event) => {
                setDiscountPercent(event.target.value)
                if (event.target.value) setDiscountFixedInput('')
              }}
            >
              <option value="">Không áp dụng %</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
            </select>
          </section>

          <section>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Hoặc giảm cố định (VNĐ)</label>
            <input
              className="h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
              placeholder="Ví dụ: 50000"
              type="text"
              inputMode="numeric"
              value={discountFixedInput}
              onChange={(event) => {
                setDiscountFixedInput(event.target.value)
                if (parseMoneyInput(event.target.value) > 0) setDiscountPercent('')
              }}
            />
            <p className="mt-2 text-xs text-gray-500">Nếu nhập VNĐ thì % đơn sẽ không áp dụng.</p>
          </section>
        </div>

        <footer className="flex justify-end gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-6 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-[#6d8c71] px-6 py-2.5 font-semibold text-white hover:bg-[#538463]"
          >
            Áp dụng
          </button>
        </footer>
      </main>
    </div>
  )
}

export default OrderOfferModal
