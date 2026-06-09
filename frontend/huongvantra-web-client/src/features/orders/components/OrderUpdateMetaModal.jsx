import { useEffect, useState } from 'react'

function OrderUpdateMetaModal({ isOpen, order, isSaving, onClose, onSave }) {
  const [shippingAddress, setShippingAddress] = useState('')
  const [note, setNote] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')

  useEffect(() => {
    if (!isOpen || !order) return
    setShippingAddress(order.shippingAddress || '')
    setNote(order.note || '')
    setDiscountAmount(String(order.discountAmount ?? ''))
  }, [isOpen, order])

  if (!isOpen || !order) return null

  async function handleSubmit(event) {
    event.preventDefault()
    await onSave({
      shippingAddress,
      note,
      discountAmount: Number(discountAmount || 0),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-[#f6f4ec] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Cập nhật thông tin</h2>
            <p className="mt-0.5 text-xs text-slate-500">{order.orderCode}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200/60"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <form className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto" onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Địa chỉ giao hàng</span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Ghi chú</span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Giảm giá (VND)</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                inputMode="decimal"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </label>
          </div>

          <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-white px-5 py-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default OrderUpdateMetaModal
