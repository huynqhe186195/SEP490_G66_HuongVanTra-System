import { useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import PosShelfStockCheckList from './PosShelfStockCheckList.jsx'
import { submitDailyShelfStocktake } from '../utils/submitDailyShelfStocktake.js'

/**
 * Màn full-screen đếm kệ đầu ngày / cuối ngày.
 */
export default function PosDailyShelfCountScreen({
  kind = 'dayStart',
  shiftLabel = '',
  onDone,
  onCancel = null,
  secondaryAction = null,
}) {
  const isEnd = kind === 'dayEnd'
  const [shelfChecked, setShelfChecked] = useState(false)
  const [shelfNote, setShelfNote] = useState('')
  const [shelfCounts, setShelfCounts] = useState({
    items: [],
    filledCount: 0,
    totalCount: 0,
    summaryText: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!shelfChecked) {
      showError(isEnd ? 'Vui lòng xác nhận đã kiểm hàng trên kệ cuối ngày.' : 'Vui lòng xác nhận đã kiểm hàng trên kệ đầu ngày.')
      return
    }
    setIsSubmitting(true)
    try {
      const stocktake = await submitDailyShelfStocktake({
        kind,
        items: shelfCounts.items,
        filledCount: shelfCounts.filledCount,
        totalCount: shelfCounts.totalCount,
        shelfNote,
        shiftLabel,
      })
      showSuccess(
        isEnd
          ? `Đã gửi phiếu kiểm kê cuối ngày ${stocktake.requestCode}. Manager duyệt tại Kiểm kê tồn kho.`
          : `Đã gửi phiếu kiểm kê đầu ngày ${stocktake.requestCode}. Manager duyệt tại Kiểm kê tồn kho.`,
      )
      onDone?.(stocktake)
    } catch (err) {
      showError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#f6f4ec]">
      <header className="shrink-0 border-b border-[#c1c9c0]/60 bg-white px-5 py-4 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">
          {isEnd ? 'Cuối ngày bắt buộc' : 'Đầu ngày bắt buộc'}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isEnd ? 'Kiểm kệ cuối ngày' : 'Kiểm kệ đầu ngày'}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {isEnd
            ? 'Đối chiếu hàng trên kệ trước khi kết thúc ngày. Kiểm tiền vẫn theo từng ca (chốt quỹ).'
            : 'Hoàn tất đối chiếu hàng trên kệ một lần mỗi ngày trước khi mở quỹ và bán hàng.'}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-white p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#356647]">
              {isEnd ? 'Hàng hóa trên kệ cuối ngày' : 'Hàng hóa trên kệ đầu ngày'}
            </h2>
            <p className="text-xs text-slate-500">
              Cột Hệ thống = tồn trên phần mềm. Nhập Thực tế theo hàng đếm được.
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            Đã điền {shelfCounts.filledCount}/{shelfCounts.totalCount || '—'} SKU
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#e7e8e0] bg-[#fbf9f1] p-3">
          <PosShelfStockCheckList
            fullHeight
            onCountsChange={(payload) =>
              setShelfCounts({
                items: payload.items || [],
                filledCount: payload.filledCount || 0,
                totalCount: payload.totalCount || 0,
                summaryText: payload.summaryText || '',
              })
            }
          />
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-[#e7e8e0] bg-[#fbf9f1] px-3 py-3 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#356647]"
            checked={shelfChecked}
            onChange={(e) => setShelfChecked(e.target.checked)}
          />
          <span>
            {isEnd
              ? 'Đã đối chiếu hàng trên kệ cuối ngày với số lượng hệ thống.'
              : 'Đã đối chiếu hàng trên kệ đầu ngày với số lượng hệ thống.'}
          </span>
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
          value={shelfNote}
          onChange={(e) => setShelfNote(e.target.value)}
          placeholder="Ghi chú lệch / thiếu (tuỳ chọn)"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {typeof onCancel === 'function' ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-[#c1c9c0] bg-white px-4 py-3 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Hủy
            </button>
          ) : null}
          {secondaryAction}
          <button
            type="button"
            disabled={isSubmitting || !shelfChecked}
            onClick={handleSubmit}
            className="rounded-xl bg-[#356647] px-5 py-3 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
          >
            {isSubmitting
              ? 'Đang gửi…'
              : isEnd
                ? 'Gửi kiểm kê cuối ngày'
                : 'Gửi kiểm kê đầu ngày & tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  )
}
