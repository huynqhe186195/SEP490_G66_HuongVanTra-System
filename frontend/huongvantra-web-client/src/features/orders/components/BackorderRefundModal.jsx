import { useEffect, useMemo, useState } from 'react'

const METHODS = [
  { id: 'Cash', label: 'Tiền mặt' },
  { id: 'Transfer', label: 'Chuyển khoản' },
]

function BackorderRefundModal({
  isOpen,
  order,
  isSaving,
  hasImmediateItems = false,
  onClose,
  onConfirm,
}) {
  const [refundMethod, setRefundMethod] = useState('Cash')
  const [refundEvidence, setRefundEvidence] = useState('')
  const [immediateItemsReturned, setImmediateItemsReturned] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setRefundMethod('Cash')
    setRefundEvidence('')
    setImmediateItemsReturned(false)
  }, [isOpen])

  const isCash = refundMethod === 'Cash'
  const evidenceRequired = !isCash
  const trimmedEvidence = refundEvidence.trim()

  const canSubmit = useMemo(() => {
    if (isSaving) return false
    if (hasImmediateItems && !immediateItemsReturned) return false
    if (evidenceRequired && trimmedEvidence.length === 0) return false
    return Boolean(refundMethod)
  }, [isSaving, hasImmediateItems, immediateItemsReturned, evidenceRequired, trimmedEvidence, refundMethod])

  if (!isOpen || !order) return null

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onConfirm({
      refundMethod,
      refundEvidence: trimmedEvidence || null,
      immediateItemsReturned: hasImmediateItems ? immediateItemsReturned : false,
    })
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
        <h3 className="text-lg font-bold text-slate-900">Hoàn tất hoàn tiền</h3>
        <p className="mt-1 text-sm text-slate-500">
          Đơn <span className="font-semibold text-slate-700">{order.orderCode}</span>
          {order.refundAmount != null ? (
            <>
              {' '}
              · Số hoàn{' '}
              <span className="font-semibold text-[#538463]">
                {new Intl.NumberFormat('vi-VN').format(Number(order.refundAmount || 0))} đ
              </span>
            </>
          ) : null}
        </p>

        <p className="mt-4 text-sm font-semibold text-slate-700">Phương thức hoàn tiền</p>
        <div className="mt-2 flex gap-2">
          {METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              disabled={isSaving}
              onClick={() => setRefundMethod(method.id)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                refundMethod === method.id
                  ? 'border-[#538463] bg-[#538463]/10 text-[#356647]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              {method.label}
            </button>
          ))}
        </div>

        {hasImmediateItems ? (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={immediateItemsReturned}
              disabled={isSaving}
              onChange={(event) => setImmediateItemsReturned(event.target.checked)}
            />
            <span>
              Đã thu hồi đầy đủ phần hàng giao ngay trước khi hoàn tiền.
            </span>
          </label>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="refund-evidence">
          Bằng chứng hoàn tiền
          {evidenceRequired ? <span className="text-red-500"> *</span> : (
            <span className="font-normal text-slate-400"> (không bắt buộc với tiền mặt)</span>
          )}
        </label>
        <textarea
          id="refund-evidence"
          rows={3}
          maxLength={1000}
          value={refundEvidence}
          disabled={isSaving}
          onChange={(event) => setRefundEvidence(event.target.value)}
          placeholder={
            evidenceRequired
              ? 'Mã giao dịch, đường dẫn chứng từ hoặc nội dung bằng chứng chuyển khoản...'
              : 'Ghi chú (không bắt buộc)...'
          }
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463] disabled:bg-slate-50"
        />

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
            {isSaving ? 'Đang xử lý...' : 'Xác nhận hoàn tiền'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BackorderRefundModal
