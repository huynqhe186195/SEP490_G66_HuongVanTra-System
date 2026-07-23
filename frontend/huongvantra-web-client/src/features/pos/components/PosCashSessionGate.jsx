import { useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCodMode } from '../../auth/utils/permissions.js'
import {
  notifyCashSessionChanged,
  openCashSession,
} from '../utils/posCashSessionStore.js'

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

/**
 * Chặn toàn bộ POS quầy đến khi mở ca quỹ.
 * Cho phép chuyển sang COD nếu user có quyền.
 */
export default function PosCashSessionGate({ onOpened, onSwitchToCod }) {
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const auth = loadAuthSession()
  const sellerName = auth?.username || 'Nhân viên POS'
  const sellerRole = (auth?.roles || []).join(', ')
  const canCod = canUsePosCodMode(auth)

  const handleOpen = () => {
    setIsSubmitting(true)
    try {
      openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: openNote,
        openedByName: sellerName,
        openedByRole: sellerRole,
        shiftLabel: 'Ca chiều quầy · 13:00–21:00 (demo)',
        shiftSlotId: 'demo-shelf-afternoon',
      })
      notifyCashSessionChanged()
      showSuccess('Đã mở ca quỹ — có thể bán tại quầy.')
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
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Bắt buộc mở ca · prototype
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Mở ca quỹ để bán tại quầy</h2>
          <p className="mt-2 text-sm text-slate-600">
            Chưa mở ca thì không dùng được POS bán trực tiếp (chọn hàng, thanh toán). Nhập tiền đầu két để
            tiếp tục.
          </p>
        </div>

        <div className="px-6 py-5">
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

          <p className="mt-4 rounded-xl bg-[#f6f4ec] px-3 py-2.5 text-xs text-slate-600">
            Ca lịch (demo): Ca chiều quầy 13:00–21:00 — sau này chỉ cho mở khi đang trong ca đã duyệt.
          </p>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleOpen}
            className="mt-5 w-full rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
          >
            {isSubmitting ? 'Đang mở…' : 'Mở ca & vào POS'}
          </button>

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
