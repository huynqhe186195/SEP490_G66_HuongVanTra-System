import { useEffect, useState } from 'react'
import { normalizeOrderDiscountInput } from '../utils/posDiscountValidation.js'

const QUICK_PERCENT_OPTIONS = [5, 10, 15, 20]

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
  const [activeType, setActiveType] = useState(initialFixedAmount > 0 ? 'fixed' : 'percent')
  const [discountFixedInput, setDiscountFixedInput] = useState('')
  const [customPercent, setCustomPercent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    const pct = initialPercent > 0 ? initialPercent : 0
    setActiveType(initialFixedAmount > 0 ? 'fixed' : 'percent')
    setCustomPercent(pct > 0 ? String(pct) : '')
    setDiscountFixedInput(initialFixedAmount > 0 ? formatMoney(initialFixedAmount) : '')
  }, [isOpen, initialPercent, initialFixedAmount])

  if (!isOpen) return null

  const maxFixed = Math.max(0, Math.round(Number(maxFixedAmount) || 0))

  const handleConfirm = () => {
    const fixedAmount = activeType === 'fixed' ? parseMoneyInput(discountFixedInput) : 0
    const rawCustom = activeType === 'percent' ? Number(customPercent) || 0 : 0

    if (activeType === 'percent' && rawCustom > 100) {
      setError('Chiết khấu % không được vượt 100%.')
      return
    }

    if (activeType === 'fixed' && fixedAmount > maxFixed) {
      setError(`Chiết khấu cố định không được vượt ${formatMoney(maxFixed)} đ.`)
      return
    }

    const percent = Math.min(100, Math.max(0, rawCustom))

    const result = normalizeOrderDiscountInput({
      percent,
      fixedAmount,
      subtotalAfterItemDiscount: maxFixed,
    })

    if (!result.ok) {
      setError(result.error)
      return
    }

    onConfirm?.({
      percent: result.orderDiscountPercent,
      fixedAmount: result.orderDiscountAmountFixed,
      warning: result.clamped ? result.warning : null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <main
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h1 className="text-lg font-semibold text-gray-800">Chiết khấu đơn</h1>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f6f4ec] p-1">
            <button
              type="button"
              onClick={() => {
                setError('')
                setActiveType('percent')
                setDiscountFixedInput('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                activeType === 'percent' ? 'bg-white text-[#356647] shadow-sm' : 'text-[#717971] hover:text-[#356647]'
              }`}
            >
              Theo %
            </button>
            <button
              type="button"
              onClick={() => {
                setError('')
                setActiveType('fixed')
                setCustomPercent('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                activeType === 'fixed' ? 'bg-white text-[#356647] shadow-sm' : 'text-[#717971] hover:text-[#356647]'
              }`}
            >
              Số tiền VNĐ
            </button>
          </div>

          {activeType === 'percent' ? (
            <section>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Phần trăm giảm</label>
              <input
                type="number"
                min={0}
                max={100}
                className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
                placeholder="Ví dụ: 25"
                value={customPercent}
                onChange={(event) => {
                  setError('')
                  const raw = event.target.value
                  setActiveType('percent')
                  if (Number(raw) > 100) {
                    setError('Chiết khấu % không được vượt 100%.')
                  }
                  setCustomPercent(raw)
                  if (raw !== '') {
                    setDiscountFixedInput('')
                  }
                }}
              />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {QUICK_PERCENT_OPTIONS.map((value) => {
                  const isSelected = Number(customPercent) === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setError('')
                        setActiveType('percent')
                        setCustomPercent(String(value))
                        setDiscountFixedInput('')
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                        isSelected
                          ? 'border-[#356647] bg-[#356647] text-white shadow-sm'
                          : 'border-gray-200 bg-white text-[#356647] hover:border-[#6d8c71] hover:bg-[#f6f4ec]'
                      }`}
                    >
                      {value}%
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">Nhập từ 0 đến 100%, hoặc chọn nhanh một mức bên dưới.</p>
            </section>
          ) : null}

          {activeType === 'fixed' ? (
            <section>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Giảm cố định (VNĐ)</label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#6d8c71] focus:ring-4 focus:ring-[#6d8c71]/15"
                placeholder={maxFixed > 0 ? `Tối đa ${formatMoney(maxFixed)} đ` : 'Thêm sản phẩm trước'}
                type="text"
                inputMode="numeric"
                value={discountFixedInput}
                onChange={(event) => {
                  setError('')
                  const parsed = parseMoneyInput(event.target.value)
                  setActiveType('fixed')
                  setDiscountFixedInput(parsed > 0 ? formatMoney(parsed) : '')
                  if (parsed > 0) {
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
                  : 'Chưa có tổng để chiết khấu - thêm sản phẩm vào giỏ.'}
              </p>
            </section>
          ) : null}

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
