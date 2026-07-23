import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  closeCashSession,
  expectedCash,
  formatVnd,
  loadOpenCashSession,
  notifyCashSessionChanged,
  openCashSession,
  subscribeCashSession,
} from '../utils/posCashSessionStore.js'

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

function formatMoneyInput(value) {
  const n = Math.round(Number(value) || 0)
  return n ? n.toLocaleString('vi-VN') : ''
}

function ModalShell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/50 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#e7e8e0] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Prototype ca quỹ</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#e7e8e0] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

export default function PosCashSessionBar() {
  const [session, setSession] = useState(() => loadOpenCashSession())
  const [modal, setModal] = useState(null) // open | close
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [countedInput, setCountedInput] = useState('')
  const [varianceNote, setVarianceNote] = useState('')

  const auth = loadAuthSession()
  const sellerName = auth?.username || 'Nhân viên POS'
  const sellerRole = (auth?.roles || []).join(', ')

  useEffect(() => subscribeCashSession(() => setSession(loadOpenCashSession())), [])

  const expected = useMemo(() => expectedCash(session), [session])

  const refresh = () => {
    setSession(loadOpenCashSession())
    notifyCashSessionChanged()
  }

  const openModal = (type) => {
    if (type === 'open') {
      setOpeningCashInput('500.000')
      setOpenNote('')
    }
    if (type === 'close') {
      setCountedInput(formatMoneyInput(expectedCash(loadOpenCashSession())))
      setVarianceNote('')
    }
    setModal(type)
  }

  const handleOpen = () => {
    try {
      openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: openNote,
        openedByName: sellerName,
        openedByRole: sellerRole,
        shiftLabel: 'Ca chiều quầy · 13:00–21:00 (demo)',
        shiftSlotId: 'demo-shelf-afternoon',
      })
      refresh()
      setModal(null)
      showSuccess('Đã mở ca quỹ POS (prototype).')
    } catch (error) {
      showError(error.message)
    }
  }

  const handleClose = () => {
    try {
      const counted = parseMoney(countedInput)
      const exp = expectedCash(loadOpenCashSession())
      const variance = counted - exp
      if (Math.abs(variance) >= 1000 && !varianceNote.trim()) {
        showError('Có chênh lệch quỹ — vui lòng nhập lý do.')
        return
      }
      const closed = closeCashSession({
        countedCash: counted,
        varianceNote,
        closedByName: sellerName,
      })
      refresh()
      setModal(null)
      showSuccess(
        closed.variance === 0
          ? 'Đã đóng ca. Quỹ khớp.'
          : `Đã đóng ca. Chênh lệch ${formatVnd(closed.variance)}.`,
      )
    } catch (error) {
      showError(error.message)
    }
  }

  const variancePreview = parseMoney(countedInput) - expected

  return (
    <>
      <div className="relative z-30 flex flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            session
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {session ? 'point_of_sale' : 'lock_clock'}
          </span>
          {session ? (
            <span>Ca đang mở</span>
          ) : (
            <span>Chưa mở ca quỹ</span>
          )}
        </div>

        {!session ? (
          <button
            type="button"
            onClick={() => openModal('open')}
            className="rounded-full bg-[#356647] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2d553b]"
          >
            Mở ca
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openModal('close')}
            className="rounded-full border border-[#356647] bg-white px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
          >
            Kiểm tiền / Đóng ca
          </button>
        )}
      </div>

      {modal === 'open' ? (
        <ModalShell
          title="Mở ca quỹ"
          subtitle="Nhập tiền mặt đầu két."
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleOpen}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white"
              >
                Mở ca
              </button>
            </>
          }
        >
          <label className="block text-xs font-semibold uppercase text-slate-500">Tiền đầu ca</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={openingCashInput}
            onChange={(e) => setOpeningCashInput(e.target.value)}
            inputMode="numeric"
            placeholder="500.000"
          />
          <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">Ghi chú</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={openNote}
            onChange={(e) => setOpenNote(e.target.value)}
            placeholder="Tuỳ chọn"
          />
        </ModalShell>
      ) : null}

      {modal === 'close' ? (
        <ModalShell
          title="Kiểm tiền & đóng ca"
          subtitle={`Kỳ vọng quỹ: ${formatVnd(expected)}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white"
              >
                Đóng ca
              </button>
            </>
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Đầu ca</p>
              <p className="font-bold text-slate-900">{formatVnd(session?.openingCash)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Thu tiền mặt</p>
              <p className="font-bold text-slate-900">{formatVnd(session?.cashSalesTotal)}</p>
            </div>
          </div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Tiền đếm thực tế</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={countedInput}
            onChange={(e) => setCountedInput(e.target.value)}
            inputMode="numeric"
          />
          <p
            className={`mt-2 text-sm font-semibold ${
              variancePreview === 0 ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            Chênh lệch: {formatVnd(variancePreview)}
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase text-slate-500">
            Lý do lệch (nếu có)
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={varianceNote}
            onChange={(e) => setVarianceNote(e.target.value)}
            placeholder="Bắt buộc khi lệch ≥ 1.000 đ"
          />
          <p className="mt-3 text-xs text-slate-500">
            Người ca sau mở ca mới và nhập tiền đầu két = số vừa đếm (nếu tiếp tục bán).
          </p>
        </ModalShell>
      ) : null}
    </>
  )
}

/** Gọi trước khi bán tại quầy — trả false nếu chưa mở ca quỹ. */
export function assertCashSessionOpenForPayment() {
  const session = loadOpenCashSession()
  if (!session) {
    showError('Chưa mở ca quỹ — không thể bán tại quầy. Hãy mở ca trên thanh POS trước.')
    return false
  }
  return true
}
