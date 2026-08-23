import { buildReturnOverridePolicyOnly } from '../../orders/utils/returnPolicyDisplay.js'

export default function ReturnExceptionPolicyModal({
  open,
  onClose,
  context,
  canManagerOverride = false,
}) {
  if (!open) return null

  const content = buildReturnOverridePolicyOnly(context, { canManagerOverride })

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-exception-policy-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h3 id="return-exception-policy-title" className="text-lg font-bold text-slate-800">
              {content.title}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">Quy định khi bật trả ngoại lệ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-700">
            {content.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#356647] py-2.5 text-sm font-bold text-white hover:bg-[#2d553c]"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReturnPolicyInfoButton({ onClick, label = 'Xem chính sách trả ngoại lệ' }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick?.(event)
      }}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#356647] transition hover:bg-[#356647]/10"
    >
      <span className="material-symbols-outlined text-[20px]">info</span>
    </button>
  )
}
