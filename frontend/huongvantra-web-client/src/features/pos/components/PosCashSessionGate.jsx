import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCodMode } from '../../auth/utils/permissions.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { openCashSession } from '../utils/posCashSessionStore.js'

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

/**
 * Chặn toàn bộ POS quầy đến khi mở ca quỹ.
 * Mọi người phải đang trong ca quầy (Shelf) đã duyệt.
 */
export default function PosCashSessionGate({ onOpened, onSwitchToCod }) {
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [onDuty, setOnDuty] = useState(null)
  const [checkingShift, setCheckingShift] = useState(true)

  const auth = loadAuthSession()
  const sellerName = auth?.username || 'Nhân viên POS'
  const sellerRole = (auth?.roles || []).join(', ')
  const canCod = canUsePosCodMode(auth)
  const canOpen = Boolean(onDuty)

  useEffect(() => {
    let cancelled = false
    setCheckingShift(true)
    fetchOnDutyShift('Shelf')
      .then((duty) => {
        if (!cancelled) setOnDuty(duty)
      })
      .catch(() => {
        if (!cancelled) setOnDuty(null)
      })
      .finally(() => {
        if (!cancelled) setCheckingShift(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpen = async () => {
    if (!canOpen) {
      showError(
        'Chỉ mở ca quỹ khi đã được duyệt ca quầy và đang trong giờ làm. Vào «Ca của tôi» để đăng ký/kiểm tra.',
      )
      return
    }
    setIsSubmitting(true)
    try {
      await openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: openNote,
        openedByName: sellerName,
        openedByRole: sellerRole,
        shiftSlotId: onDuty?.slotId || null,
        shiftLabel: onDuty?.label || null,
      })
      showSuccess(onDuty?.label ? `Đã mở ca quỹ · ${onDuty.label}` : 'Đã mở ca quỹ — có thể bán tại quầy.')
      onOpened?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#1b1c17]/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/40 bg-white shadow-2xl">
        <div className="border-b border-[#e7e8e0] px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Bắt buộc mở ca</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Mở ca quỹ để bán tại quầy</h2>
          <p className="mt-2 text-sm text-slate-600">
            {checkingShift
              ? 'Đang kiểm tra ca làm việc của bạn…'
              : onDuty
                ? `Bạn đang trong ${onDuty.label}. Nhập tiền đầu két để tiếp tục.`
                : 'Bạn phải đang trong ca quầy (Shelf) đã duyệt. Vào «Ca của tôi» để đăng ký và chờ Manager duyệt.'}
          </p>
        </div>

        <div className="px-6 py-5">
          {canOpen ? (
            <>
              <label className="block text-xs font-semibold uppercase text-slate-500">Tiền đầu ca</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                inputMode="numeric"
                placeholder="500.000"
                autoFocus
              />

              <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">Ghi chú</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="Tuỳ chọn"
              />

              <button
                type="button"
                disabled={isSubmitting || checkingShift}
                onClick={handleOpen}
                className="mt-5 w-full rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
              >
                {isSubmitting ? 'Đang mở…' : 'Mở ca & vào POS'}
              </button>
            </>
          ) : (
            <Link
              to="/my-shifts"
              className="mt-1 flex w-full items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b]"
            >
              Tới «Ca của tôi»
            </Link>
          )}

          {canCod && typeof onSwitchToCod === 'function' ? (
            <button
              type="button"
              onClick={onSwitchToCod}
              className="mt-3 w-full rounded-xl border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Không mở ca — chuyển sang bán COD
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
