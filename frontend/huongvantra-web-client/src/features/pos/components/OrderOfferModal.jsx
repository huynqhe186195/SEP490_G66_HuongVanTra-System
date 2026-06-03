import { useEffect, useState } from 'react'
import { normalizeOrderDiscountInput } from '../utils/posDiscountValidation.js'

function parseMoneyInput(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))
}

function OrderOfferModal({
  isOpen,
  onClose,
  onConfirm,
  initialPercent = 0,
  initialFixedAmount = 0,
  maxFixedAmount = 0,
}) {
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountFixedInput, setDiscountFixedInput] = useState('')
  const [customPercent, setCustomPercent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    const pct = initialPercent > 0 ? initialPercent : 0
    const preset = [5, 10, 15, 20].includes(pct) ? String(pct) : ''
    setDiscountPercent(preset)
    setCustomPercent(preset ? '' : pct > 0 ? String(pct) : '')
    setDiscountFixedInput(initialFixedAmount > 0 ? String(initialFixedAmount) : '')
  }, [isOpen, initialPercent, initialFixedAmount])

  if (!isOpen) return null

  const maxFixed = Math.max(0, Math.round(Number(maxFixedAmount) || 0))

  const handleConfirm = () => {
    const fixedAmount = parseMoneyInput(discountFixedInput)
    const fromSelect = Number(discountPercent) || 0
    const fromCustom = Math.min(100, Math.max(0, Number(customPercent) || 0))
    const percent = fixedAmount > 0 ? 0 : fromSelect > 0 ? fromSelect : fromCustom

    const result = normalizeOrderDiscountInput({
      percent,
      fixedAmount,
      subtotalAfterItemDiscount: maxFixed,
    })

    if (!result.ok) {
      setError(result.error)
      return
    }

    if (onConfirm) {
      onConfirm({
        percent: result.orderDiscountPercent,
        fixedAmount: result.orderDiscountAmountFixed,
        warning: result.clamped ? result.warning : null,
      })
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
                setError('')
                setDiscountPercent(event.target.value)
                if (event.target.value) {
                  setDiscountFixedInput('')
                  setCustomPercent('')
                }
              }}
            >
              <option value="">Không áp dụng %</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
            </select>
            <label className="mt-3 mb-1 block text-xs font-medium text-gray-600">Hoặc % khác (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              disabled={parseMoneyInput(discountFixedInput) > 0}
              className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15 disabled:bg-gray-50"
              placeholder="Ví dụ: 25"
              value={customPercent}
              onChange={(event) => {
                setError('')
                const raw = event.target.value
                setCustomPercent(raw)
                if (raw !== '') {
                  setDiscountPercent('')
                  setDiscountFixedInput('')
                }
              }}
            />
          </section>

          <section>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Hoặc giảm cố định (VNĐ)</label>
            <input
              className="h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
              placeholder={maxFixed > 0 ? `Tối đa ${formatMoney(maxFixed)} đ` : 'Thêm sản phẩm trước'}
              type="text"
              inputMode="numeric"
              value={discountFixedInput}
              onChange={(event) => {
                setError('')
                const parsed = parseMoneyInput(event.target.value)
                setDiscountFixedInput(event.target.value)
                if (parsed > 0) {
                  setDiscountPercent('')
                  setCustomPercent('')
                }
                if (maxFixed > 0 && parsed > maxFixed) {
                  setError(`Chiết khấu không được vượt ${formatMoney(maxFixed)} đ (tổng sau CK dòng).`)
                }
              }}
            />
            <p className="mt-2 text-xs text-gray-500">
              {maxFixed > 0
                ? `Tối đa ${formatMoney(maxFixed)} đ sau CK từng SP. Nhập VNĐ thì % đơn không áp dụng.`
                : 'Chưa có tổng để chiết khấu — thêm sản phẩm vào giỏ.'}
            </p>
          </section>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : null}
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
