function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

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
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#1b1c17]">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm leading-relaxed text-[#414942]">
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
            className="rounded-lg bg-[#b42318] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#912018]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
