import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCounterMode, canViewAllOrders } from '../../auth/utils/permissions.js'
import { isCashSessionReadyForSale } from '../services/posCashSessionApi.js'
import {
  closeCashSession,
  expectedCash,
  formatVnd,
  loadOpenCashSession,
  openCashSession,
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

function ModalShell({ eyebrow, title, subtitle, onClose, children, footer }) {
  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/50 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#e7e8e0] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">{eyebrow || 'Quỹ POS'}</p>
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
  return createPortal(content, document.body)
}

function StatusDot({ ok }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
      aria-hidden
    />
  )
}

/**
 * Thanh Quỹ / Kệ POS.
 * Sale chỉ đóng quỹ mình mở; Sale ca sau không đóng hộ — Manager đóng hộ được (POS / Lịch).
 * Không tự đóng hết ca; logout/tab vẫn nhắc nếu quỹ mình còn Open.
 */
export default function PosCashSessionBar({
  dayStartDone = true,
  dayEndDone = false,
  onRequestDayEnd,
  onCashOpened,
  sellerName = '',
  sellerRole = '',
  shiftSlotId = null,
  shiftLabel = null,
}) {
  const auth = loadAuthSession()
  const isManager = canViewAllOrders(auth)
  const [session, setSession] = useState(() => loadOpenCashSession())
  const [modal, setModal] = useState(null)
  const [countedInput, setCountedInput] = useState('')
  const [varianceNote, setVarianceNote] = useState('')
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    refreshCashSession().then((s) => setSession(s))
    return subscribeCashSession(() => setSession(loadOpenCashSession()))
  }, [])

  useEffect(() => {
    if (!shiftSlotId) return
    refreshCashSession().then((s) => setSession(s))
  }, [shiftSlotId])

  if (!canUsePosCounterMode(auth)) return null

  const requiresClose = Boolean(session?.requiresCloseForNewShift)
    || (
      Boolean(session)
      && session.status !== 'Closed'
      && session.canCloseSession === false
      && !isManager
    )
  const canCloseForeign = requiresClose && isManager
  const readyForSale = isCashSessionReadyForSale(session) && !requiresClose
  const expected = expectedCash(session)
  const canDayEnd = typeof onRequestDayEnd === 'function'
  const showDayEndAction = canDayEnd && !dayEndDone
  const previousLabelRaw = String(session?.previousShiftLabel || session?.shiftLabel || '').trim()
  const previousLabel = previousLabelRaw || 'quỹ đang mở'
  const openerName = session?.openedByName || 'Sale ca trước'
  const blockedCloseMessage =
    session?.closeBlockedMessage
    || `Quỹ «${previousLabel}» vẫn đang mở (do ${openerName}). Báo họ đóng — bạn không đóng hộ được.`

  const statusLabel = requiresClose
    ? (previousLabelRaw ? `Chưa đóng · ${previousLabelRaw}` : 'Chưa đóng quỹ')
    : readyForSale
      ? (session?.shiftLabel ? `Đang mở · ${session.shiftLabel}` : 'Đang mở')
      : 'Đã đóng'

  const foreignHint = canCloseForeign
    ? (previousLabelRaw
      ? `Đóng quỹ «${previousLabelRaw}» (QL) — hoặc đóng đúng ô trên Lịch làm việc`
      : 'Đóng quỹ đang mở (QL) — hoặc đóng đúng ô trên Lịch làm việc')
    : `Báo ${openerName} đóng quỹ`

  const openModal = (type) => {
    if (type === 'close') {
      if (requiresClose && !canCloseForeign) {
        showError(blockedCloseMessage)
        return
      }
      setCountedInput(formatMoneyInput(expectedCash(loadOpenCashSession())))
      setVarianceNote('')
    }
    if (type === 'open') {
      if (isManager) {
        showError('Quản lý mở quỹ tại «Lịch làm việc» — chọn đúng ô ca rồi bấm Mở quỹ ca này.')
        return
      }
      if (requiresClose) {
        showError(blockedCloseMessage)
        return
      }
      setOpeningCashInput('500.000')
      setOpenNote('')
    }
    setModal(type)
  }

  const handleRequestDayEnd = () => {
    if (!dayStartDone) {
      showError('Cần hoàn tất kiểm kệ đầu ngày trước khi chốt cuối ngày.')
      return
    }
    onRequestDayEnd()
  }

  const handleOpen = async () => {
    setBusy(true)
    try {
      await openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: openNote.trim() || null,
        openedByName: sellerName || auth?.username || 'Nhân viên POS',
        openedByRole: sellerRole || (auth?.roles || []).join(', '),
        shiftSlotId,
        shiftLabel,
      })
      setModal(null)
      showSuccess('Đã mở quỹ. Có thể bán tại quầy.')
      onCashOpened?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClose = async () => {
    if (requiresClose && !canCloseForeign) {
      showError(blockedCloseMessage)
      setModal(null)
      return
    }
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
      await refreshCashSession()
      setModal(null)
      if (requiresClose && canCloseForeign) {
        showSuccess(
          Number(closed?.variance || 0) === 0
            ? `Đã đóng quỹ «${previousLabel}». Sale ca hiện tại có thể mở quỹ.`
            : `Đã đóng quỹ «${previousLabel}». Chênh lệch ${formatVnd(closed.variance)}.`,
        )
      } else {
        showSuccess(
          Number(closed?.variance || 0) === 0
            ? 'Đã đóng quỹ.'
            : `Đã đóng quỹ. Chênh lệch ${formatVnd(closed.variance)}.`,
        )
      }
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const variancePreview = parseMoney(countedInput) - expected

  return (
    <>
      <div className="relative z-30 flex max-w-full flex-row items-stretch gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-[#c1c9c0]/70 bg-white px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 pr-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#356647]">payments</span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#717971]">Quỹ · theo ca</p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <StatusDot ok={readyForSale} />
                {statusLabel}
              </p>
            </div>
          </div>
          <span className="hidden h-7 w-px bg-[#e7e8e0] sm:block" aria-hidden />
          {requiresClose ? (
            <>
              <p className="max-w-[14rem] text-[10px] leading-snug text-amber-800 sm:max-w-xs">
                {foreignHint}
              </p>
              <button
                type="button"
                onClick={() => openModal('check')}
                className="rounded-full border border-[#c1c9c0] bg-[#fbf9f1] px-2.5 py-1 text-xs font-bold text-[#356647] hover:bg-[#f0f7f0]"
              >
                Xem tiền
              </button>
              {canCloseForeign ? (
                <button
                  type="button"
                  onClick={() => openModal('close')}
                  className="rounded-full bg-amber-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-800"
                >
                  Đóng quỹ ca trước (QL)
                </button>
              ) : null}
            </>
          ) : readyForSale ? (
            <>
              <button
                type="button"
                onClick={() => openModal('check')}
                className="rounded-full border border-[#c1c9c0] bg-[#fbf9f1] px-2.5 py-1 text-xs font-bold text-[#356647] hover:bg-[#f0f7f0]"
              >
                Xem tiền
              </button>
              <button
                type="button"
                onClick={() => openModal('close')}
                className="rounded-full bg-[#356647] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#2d553b]"
              >
                Đóng quỹ
              </button>
            </>
          ) : dayEndDone ? (
            <p className="text-[11px] text-slate-500">Không mở quỹ — ngày đã chốt kệ</p>
          ) : isManager ? (
            <Link
              to="/shifts"
              className="rounded-full border border-[#356647]/40 bg-[#f0f7f0] px-2.5 py-1 text-xs font-bold text-[#356647] hover:bg-[#e5f0e6]"
            >
              Mở quỹ trên Lịch ca
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openModal('open')}
              className="rounded-full bg-[#356647] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#2d553b]"
            >
              Mở quỹ
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 pr-1.5">
            <span className="material-symbols-outlined text-[18px] text-amber-800">inventory_2</span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/70">Kệ · theo ngày</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-amber-950">
                <span className="inline-flex items-center gap-1">
                  <StatusDot ok={dayStartDone} />
                  Đầu ngày
                </span>
                <span className="text-amber-700/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <StatusDot ok={dayEndDone} />
                  Cuối ngày
                </span>
              </p>
            </div>
          </div>
          <span className="hidden h-7 w-px bg-amber-200 sm:block" aria-hidden />
          {dayEndDone ? (
            <p className="text-[11px] font-semibold text-emerald-800">Đã chốt ngày</p>
          ) : showDayEndAction ? (
            <button
              type="button"
              onClick={handleRequestDayEnd}
              className="rounded-full border border-amber-500 bg-white px-2.5 py-1 text-xs font-bold text-amber-950 hover:bg-amber-100"
            >
              Chốt kệ cuối ngày
            </button>
          ) : (
            <p className="text-[11px] text-amber-900/70">Chỉ Sale chốt kệ</p>
          )}
        </div>
      </div>

      {modal === 'open' ? (
        <ModalShell
          eyebrow="Quỹ · theo ca"
          title="Mở quỹ"
          subtitle="Nhập tiền mặt đầu két để bán tại quầy"
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
                onClick={handleOpen}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Đang mở…' : 'Mở quỹ'}
              </button>
            </>
          }
        >
          <label className="block text-xs font-semibold text-slate-600">Tiền mặt đầu két</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={openingCashInput}
            onChange={(e) => setOpeningCashInput(e.target.value)}
            inputMode="numeric"
            autoFocus
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Ghi chú (tuỳ chọn)</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={openNote}
            onChange={(e) => setOpenNote(e.target.value)}
          />
        </ModalShell>
      ) : null}

      {modal === 'check' ? (
        <ModalShell
          eyebrow="Quỹ · theo ca"
          title="Xem tiền trong két"
          subtitle="Chỉ xem — không đóng quỹ"
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
              <p className="text-xs text-slate-500">Đầu quỹ</p>
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
        </ModalShell>
      ) : null}

      {modal === 'close' ? (
        <ModalShell
          eyebrow="Quỹ · theo ca"
          title={canCloseForeign ? `Đóng quỹ «${previousLabel}» (QL)` : 'Đóng quỹ'}
          subtitle={
            canCloseForeign
              ? `Đóng hộ quỹ do ${openerName} mở. Ước tính: ${formatVnd(expected)}`
              : `Đếm tiền rồi đóng quỹ. Ước tính: ${formatVnd(expected)}`
          }
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
                {busy ? 'Đang đóng…' : 'Xác nhận đóng quỹ'}
              </button>
            </>
          }
        >
          <p className="mb-3 rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-xs text-slate-700">
            {canCloseForeign ? (
              <>
                Sau khi đóng, Sale ca hiện tại bấm <strong>Mở quỹ</strong>. Quỹ không tự đóng — QL đóng trên «Lịch làm việc» hoặc POS.
              </>
            ) : (
              <>
                Nên đóng khi hết ca. Quên đóng → nhắc khi đăng xuất; nhờ Quản lý đóng trên «Lịch làm việc» nếu cần.
              </>
            )}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Đầu quỹ</p>
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
  if (!session || session.status === 'Closed') {
    showError('Quỹ đang đóng — bấm «Mở quỹ» trên thanh POS trước khi bán.')
    return false
  }
  if (session.requiresCloseForNewShift || session.canCloseSession === false) {
    const label = session.previousShiftLabel || session.shiftLabel || 'quỹ đang mở'
    const opener = session.openedByName || 'Sale ca trước'
    showError(
      session.closeBlockedMessage
      || `Quỹ «${label}» vẫn đang mở (do ${opener}). Báo họ đóng rồi mở quỹ ca bạn trước khi bán.`,
    )
    return false
  }
  return true
}
