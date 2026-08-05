import { useEffect, useState } from 'react'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'

const MAX_REASON_LENGTH = 500

function ReceiptReprintModal({ isOpen, order, isSaving, onClose, onConfirm }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  if (!isOpen || !order) return null

  const trimmedReason = reason.trim()
  const canSubmit = trimmedReason.length > 0 && !isSaving

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onConfirm(trimmedReason)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={isSaving ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-bold text-slate-900">In lại hóa đơn</h3>
        <p className="mt-1 text-sm text-slate-500">
          Đơn <span className="font-semibold text-slate-700">{order.orderCode}</span>. Mỗi lần in lại
          đều được ghi nhận vào nhật ký kiểm soát.
        </p>

        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="reprint-reason">
          Lý do in lại <span className="text-red-500">*</span>
        </label>
        <ReasonSuggestionChips
          className="mt-2"
          suggestions={getReasonSuggestions('receiptReprint')}
          value={reason}
          onSelect={setReason}
        />
        <textarea
          id="reprint-reason"
          rows={3}
          maxLength={MAX_REASON_LENGTH}
          value={reason}
          disabled={isSaving}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ví dụ: khách yêu cầu bản in bổ sung, máy in lỗi giấy..."
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] disabled:bg-slate-50"
        />
        <p className="mt-1 text-xs text-slate-400">
          {trimmedReason.length}/{MAX_REASON_LENGTH} ký tự
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
          >
            {isSaving ? 'Đang ghi nhận...' : 'Xác nhận in lại'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReceiptReprintModal
