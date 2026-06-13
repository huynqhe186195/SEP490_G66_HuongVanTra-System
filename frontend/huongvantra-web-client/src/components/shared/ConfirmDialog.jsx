function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  const confirmClass =
    tone === 'primary'
      ? 'bg-[#356647] hover:bg-[#4e7f5e]'
      : 'bg-[#b42318] hover:bg-[#912018]'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/60 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[#7e5700]">info</span>
          <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#1b1c17]">
            {title}
          </h2>
        </div>
        <p id="confirm-dialog-message" className="text-sm leading-relaxed text-[#414942]">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
