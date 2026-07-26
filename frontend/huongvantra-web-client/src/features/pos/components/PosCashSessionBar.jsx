import { useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCounterMode } from '../../auth/utils/permissions.js'
import {
  closeCashSession,
  expectedCash,
  formatVnd,
  loadOpenCashSession,
  refreshCashSession,
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
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Ca làm việc POS</p>
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

/** Thanh ca: Kiểm tiền / Chốt cuối ca. Mở ca + kiểm kệ chỉ qua màn full-screen PosShiftDutyGate. */
export default function PosCashSessionBar() {
  const auth = loadAuthSession()
  const [session, setSession] = useState(() => loadOpenCashSession())
  const [modal, setModal] = useState(null)
  const [countedInput, setCountedInput] = useState('')
  const [varianceNote, setVarianceNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    refreshCashSession().then((s) => setSession(s))
    return subscribeCashSession(() => setSession(loadOpenCashSession()))
  }, [])

  // COD / không có quyền quầy: không hiện kiểm tiền / chốt ca quỹ POS.
  if (!canUsePosCounterMode(auth)) return null

  const expected = expectedCash(session)

  const openModal = (type) => {
    if (type === 'close') {
      setCountedInput(formatMoneyInput(expectedCash(loadOpenCashSession())))
      setVarianceNote('')
    }
    setModal(type)
  }

  const handleClose = async () => {
    setBusy(true)
    try {
      const counted = parseMoney(countedInput)
      const exp = expectedCash(loadOpenCashSession())
      const variance = counted - exp
      if (Math.abs(variance) >= 1000 && !varianceNote.trim()) {
        showError('Có chênh lệch quỹ — vui lòng nhập lý do.')
        return
      }
      const closed = await closeCashSession({
        countedCash: counted,
        varianceNote,
      })
      setModal(null)
      showSuccess(
        Number(closed?.variance || 0) === 0
          ? 'Đã chốt tiền cuối ca. Quỹ khớp.'
          : `Đã chốt tiền. Chênh lệch ${formatVnd(closed.variance)}.`,
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
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
          {session ? <span>Ca đang mở</span> : <span>Chưa mở ca</span>}
        </div>

        {session ? (
          <>
            <button
              type="button"
              onClick={() => openModal('check')}
              className="rounded-full border border-[#c1c9c0] bg-white px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Kiểm tiền
            </button>
            <button
              type="button"
              onClick={() => openModal('close')}
              className="rounded-full border border-[#356647] bg-white px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
            >
              Chốt tiền cuối ca
            </button>
          </>
        ) : null}
      </div>

      {modal === 'check' ? (
        <ModalShell
          title="Kiểm tiền"
          subtitle="Ca đang mở"
          onClose={() => setModal(null)}
          footer={
            <button
              type="button"
              onClick={() => setModal(null)}
              className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white"
            >
              Đóng
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Đầu ca</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.openingCash)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Thu tiền mặt</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.cashSalesTotal)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Hoàn tiền mặt</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.cashRefundTotal)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="text-xs text-emerald-800">Trong két (ước tính)</p>
              <p className="mt-1 font-bold text-emerald-950">{formatVnd(expected)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Đây là kiểm tra giữa ca. Để kết thúc ca, dùng «Chốt tiền cuối ca».
          </p>
        </ModalShell>
      ) : null}

      {modal === 'close' ? (
        <ModalShell
          title="Chốt tiền cuối ca"
          subtitle={`Tiền trong két (ước tính): ${formatVnd(expected)}`}
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
                disabled={busy}
                onClick={handleClose}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Đang chốt…' : 'Chốt & đóng ca'}
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
        </ModalShell>
      ) : null}
    </>
  )
}

export function assertCashSessionOpenForPayment(shelfOnDuty) {
  if (!shelfOnDuty) {
    showError(
      'Chưa được duyệt ca quầy hoặc đang ngoài giờ ca — không thể bán tại quầy. Vào «Lịch làm việc» để đăng ký.',
    )
    return false
  }
  const session = loadOpenCashSession()
  if (!session) {
    showError('Chưa mở ca — hoàn tất kiểm kệ & kiểm tiền đầu ca trước khi bán.')
    return false
  }
  return true
}
