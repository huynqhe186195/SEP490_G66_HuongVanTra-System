import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
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

function StatusPill({ tone, children }) {
  const tones = {
    open: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
    idle: 'bg-slate-100 text-slate-600 ring-slate-200/80',
    other: 'bg-amber-100 text-amber-950 ring-amber-200/80',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tones[tone] || tones.idle}`}
    >
      {children}
    </span>
  )
}

/**
 * Panel quỹ trong Chi tiết ca (Lịch làm việc) — Manager mở/đóng đúng slot.
 * compact: bỏ lặp tên/ngày giờ (đã có ở panel cha).
 */
export default function ManagerSlotCashFundPanel({
  slot,
  template,
  enabled = true,
  compact = false,
}) {
  const auth = loadAuthSession()
  const [session, setSession] = useState(() => loadOpenCashSession())
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState(null)
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [countedInput, setCountedInput] = useState('')
  const [varianceNote, setVarianceNote] = useState('')

  useEffect(() => {
    if (!enabled) return undefined
    refreshCashSession().then(setSession)
    return subscribeCashSession(() => setSession(loadOpenCashSession()))
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const id = window.setInterval(() => {
      refreshCashSession().catch(() => {})
    }, 30_000)
    return () => window.clearInterval(id)
  }, [enabled])

  useEffect(() => {
    setMode(null)
  }, [slot?.id])

  const slotId = slot?.id ? String(slot.id) : ''
  const area = String(template?.area || '').toLowerCase()
  const isShelf = area === 'shelf' || String(template?.areaLabel || '').includes('quầy')

  const hasOpenAnywhere = Boolean(
    session
    && session.status !== 'Closed'
    && (session.id || session.openedAt),
  )

  const openForThisSlot = useMemo(() => {
    if (!hasOpenAnywhere || !slotId) return false
    if (!session?.shiftSlotId) return false
    return String(session.shiftSlotId) === slotId
  }, [hasOpenAnywhere, session, slotId])

  if (!enabled || !slot || !isShelf) return null

  const shiftLabel = template?.name || 'Ca quầy'
  const hoursLabel = `${template?.start || '—'}–${template?.end || '—'}`
  const exp = expectedCash(session)
  const variancePreview = parseMoney(countedInput) - exp
  const openLabel = session?.previousShiftLabel || session?.shiftLabel || 'quỹ đang mở'
  const openerName = session?.openedByName || '—'

  const handleOpen = async () => {
    setBusy(true)
    try {
      await openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: `QL mở từ Lịch · ${shiftLabel} · ${slot.workDate || ''}`,
        openedByName: auth?.username || 'Manager',
        openedByRole: (auth?.roles || []).join(', ') || 'Manager',
        shiftSlotId: slot.id,
        shiftLabel,
        workDate: slot.workDate || null,
        shiftEnd: template?.end || null,
      })
      setMode(null)
      setSession(loadOpenCashSession())
      showSuccess(`Đã mở quỹ «${shiftLabel}» · ${slot.workDate || ''}.`)
    } catch (error) {
      showError(error.message || 'Không mở được quỹ.')
    } finally {
      setBusy(false)
    }
  }

  const handleClose = async () => {
    setBusy(true)
    try {
      const counted = parseMoney(countedInput)
      if (Math.abs(counted - exp) >= 1000 && !varianceNote.trim()) {
        showError('Có chênh lệch quỹ — vui lòng nhập lý do.')
        return
      }
      await closeCashSession({
        countedCash: counted,
        varianceNote,
        expectedShiftSlotId: slot.id,
      })
      await refreshCashSession()
      setSession(loadOpenCashSession())
      setMode(null)
      showSuccess(`Đã đóng quỹ «${shiftLabel}».`)
    } catch (error) {
      showError(error.message || 'Không đóng được quỹ.')
    } finally {
      setBusy(false)
    }
  }

  const statusTone = openForThisSlot ? 'open' : hasOpenAnywhere ? 'other' : 'idle'
  const statusText = openForThisSlot
    ? 'Đang mở'
    : hasOpenAnywhere
      ? 'Ở ca khác'
      : 'Chưa mở'

  return (
    <section className="mt-2.5 overflow-hidden rounded-xl border border-[#c1c9c0]/60 bg-[#fbf9f1]/80">
      <div className="flex items-center justify-between gap-2 border-b border-[#e7e8e0] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#356647]">payments</span>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#717971]">Quỹ POS</p>
          {!compact ? (
            <span className="truncate text-[11px] text-slate-500">
              {shiftLabel}
              {' · '}
              {hoursLabel}
            </span>
          ) : null}
        </div>
        <StatusPill tone={statusTone}>{statusText}</StatusPill>
      </div>

      <div className="px-2.5 py-2">
        {openForThisSlot ? (
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">{openerName}</span>
            {' · '}
            {formatVnd(exp)}
          </p>
        ) : hasOpenAnywhere ? (
          <p className="text-[11px] leading-snug text-amber-900">
            Đang mở «{openLabel}»{openerName ? ` · ${openerName}` : ''}. Chọn đúng ca đó để đóng.
          </p>
        ) : (
          <p className="text-[11px] text-slate-500">Chưa mở quỹ cho ca này.</p>
        )}

        {mode === 'open' ? (
          <div className="mt-2 space-y-2 rounded-lg border border-[#356647]/15 bg-white px-2.5 py-2">
            <label className="block text-[10px] font-semibold text-slate-500">Tiền đầu két</label>
            <input
              className="w-full rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[#356647]"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={handleOpen}
                className="flex-1 rounded-lg bg-[#356647] px-2 py-1.5 text-[11px] font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
              >
                {busy ? '…' : 'Mở quỹ'}
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'close' ? (
          <div className="mt-2 space-y-2 rounded-lg border border-amber-200/70 bg-white px-2.5 py-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Ước tính</span>
              <span className="font-bold">{formatVnd(exp)}</span>
            </div>
            <label className="block text-[10px] font-semibold text-slate-500">Tiền đếm</label>
            <input
              className="w-full rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[#356647]"
              value={countedInput}
              onChange={(e) => setCountedInput(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
            <p className={`text-[11px] font-semibold ${variancePreview === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
              Lệch: {formatVnd(variancePreview)}
            </p>
            <input
              className="w-full rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs outline-none focus:border-[#356647]"
              value={varianceNote}
              onChange={(e) => setVarianceNote(e.target.value)}
              placeholder="Lý do lệch (≥ 1.000 đ)"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={handleClose}
                className="flex-1 rounded-lg bg-[#8a5a2b] px-2 py-1.5 text-[11px] font-bold text-white hover:bg-[#734a22] disabled:opacity-60"
              >
                {busy ? '…' : 'Đóng quỹ'}
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}

        {!mode ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {openForThisSlot ? (
              <button
                type="button"
                onClick={() => {
                  setCountedInput(formatMoneyInput(exp))
                  setVarianceNote('')
                  setMode('close')
                }}
                className="w-full rounded-lg bg-[#8a5a2b] px-2 py-1.5 text-[11px] font-bold text-white hover:bg-[#734a22]"
              >
                Đóng quỹ
              </button>
            ) : null}
            {!hasOpenAnywhere ? (
              <button
                type="button"
                onClick={() => {
                  setOpeningCashInput('500.000')
                  setMode('open')
                }}
                className="w-full rounded-lg bg-[#356647] px-2 py-1.5 text-[11px] font-bold text-white hover:bg-[#2d553b]"
              >
                Mở quỹ
              </button>
            ) : null}
            {hasOpenAnywhere && !openForThisSlot ? (
              <button
                type="button"
                onClick={() => refreshCashSession().then(setSession)}
                className="w-full rounded-lg border border-[#c1c9c0] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#356647]"
              >
                Làm mới
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
