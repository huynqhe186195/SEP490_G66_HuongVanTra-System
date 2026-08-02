import { useEffect, useId, useRef, useState } from 'react'
import ReasonSuggestionChips from '../components/shared/ReasonSuggestionChips.jsx'

const EVENT_NAME = 'app-dialog'

export default function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    function onDialog(event) {
      const detail = event.detail
      if (!detail || typeof detail.resolve !== 'function') return

      setDialog((current) => {
        if (current?.resolve) {
          current.resolve(current.kind === 'prompt' ? null : false)
        }
        return detail
      })
      setInputValue(detail.defaultValue ?? '')
    }

    window.addEventListener(EVENT_NAME, onDialog)
    return () => window.removeEventListener(EVENT_NAME, onDialog)
  }, [])

  useEffect(() => {
    if (!dialog) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(dialog.kind === 'prompt' ? null : dialog.kind === 'alert' ? true : false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, inputValue])

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [dialog])

  function finish(result) {
    if (!dialog) return
    const { resolve } = dialog
    setDialog(null)
    setInputValue('')
    resolve(result)
  }

  function handleConfirm() {
    if (!dialog) return
    if (dialog.kind === 'prompt') {
      const value = inputValue.trim()
      if (dialog.required && !value) return
      finish(value)
      return
    }
    finish(true)
  }

  function handleCancel() {
    if (!dialog) return
    if (dialog.kind === 'alert') {
      finish(true)
      return
    }
    finish(dialog.kind === 'prompt' ? null : false)
  }

  const confirmClass =
    dialog?.tone === 'primary'
      ? 'bg-[#356647] hover:bg-[#4e7f5e]'
      : 'bg-[#b42318] hover:bg-[#912018]'

  const canConfirmPrompt =
    dialog?.kind !== 'prompt' || !dialog.required || Boolean(inputValue.trim())

  return (
    <>
      {children}
      {dialog ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={handleCancel}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/60 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[22px] ${
                  dialog.tone === 'primary' ? 'text-[#356647]' : 'text-[#b42318]'
                }`}
              >
                {dialog.kind === 'prompt' ? 'edit_note' : dialog.kind === 'alert' ? 'info' : 'help'}
              </span>
              <h2 id={titleId} className="text-lg font-bold text-[#1b1c17]">
                {dialog.title}
              </h2>
            </div>

            {dialog.message ? (
              <p id={messageId} className="whitespace-pre-line text-sm leading-relaxed text-[#414942]">
                {dialog.message}
              </p>
            ) : (
              <span id={messageId} className="sr-only">
                Hộp thoại xác nhận
              </span>
            )}

            {dialog.kind === 'prompt' ? (
              <div className="mt-4 space-y-3">
                <ReasonSuggestionChips
                  suggestions={dialog.suggestions}
                  value={inputValue}
                  onSelect={setInputValue}
                />
                <label className="block">
                  <span className="sr-only">{dialog.placeholder || 'Nội dung'}</span>
                  <textarea
                    ref={inputRef}
                    rows={3}
                    className="w-full rounded-xl border-2 border-[#c1c9c0] px-3 py-2.5 text-sm text-[#1b1c17] outline-none focus:border-[#356647]"
                    value={inputValue}
                    placeholder={dialog.placeholder || 'Nhập nội dung...'}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        handleConfirm()
                      }
                    }}
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              {dialog.kind === 'alert' ? null : (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]"
                >
                  {dialog.cancelLabel || 'Hủy bỏ'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirmPrompt}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}
              >
                {dialog.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
