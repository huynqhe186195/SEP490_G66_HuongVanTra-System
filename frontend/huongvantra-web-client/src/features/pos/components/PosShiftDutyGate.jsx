import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCodMode, canViewAllOrders } from '../../auth/utils/permissions.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { shiftDisplayName } from '../utils/shiftDisplayName.js'
import { openCashSession } from '../utils/posCashSessionStore.js'
import PosShelfStockCheckList from './PosShelfStockCheckList.jsx'

const BYPASSED_DUTY = { bypassed: true }

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

function GateShell({ children }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-[#fbf9f1] p-4 shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:rounded-[28px]">
      {children}
    </div>
  )
}

function GateCard({ eyebrow, eyebrowTone = 'amber', title, body, children, wide = false }) {
  const eyebrowClass =
    eyebrowTone === 'rose'
      ? 'text-rose-700'
      : eyebrowTone === 'green'
        ? 'text-[#538463]'
        : 'text-amber-700'
  return (
    <div
      className={`w-full rounded-2xl border border-[#c1c9c0]/40 bg-white shadow-2xl ${
        wide ? 'max-w-2xl' : 'max-w-md'
      }`}
    >
      <div className="border-b border-[#e7e8e0] px-6 py-5">
        <p className={`text-xs font-bold uppercase tracking-wide ${eyebrowClass}`}>{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        {body ? <p className="mt-2 text-sm text-slate-600">{body}</p> : null}
      </div>
      <div className="flex flex-col gap-2 px-6 py-5">{children}</div>
    </div>
  )
}

/**
 * Cổng vào POS dùng chung SalePos + SaleCod:
 * 1) Chưa trong ca quầy → màn khóa
 * 2) Quầy: đã trong ca nhưng chưa mở quỹ → kiểm tiền + kiểm kệ đầu ca rồi mở ca
 * Manager/Admin bỏ qua bước (1).
 */
export default function PosShiftDutyGate({
  onDutyChange,
  children,
  requireCashSession = false,
  cashSessionOpen = false,
  onCashOpened,
  onSwitchToCod,
}) {
  const auth = loadAuthSession()
  const bypass = canViewAllOrders(auth)
  const canCod = canUsePosCodMode(auth)
  const sellerName = auth?.username || 'Nhân viên POS'
  const sellerRole = (auth?.roles || []).join(', ')

  const [onDuty, setOnDuty] = useState(null)
  const [checking, setChecking] = useState(!bypass)
  const [error, setError] = useState('')
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [shelfChecked, setShelfChecked] = useState(false)
  const [shelfNote, setShelfNote] = useState('')
  const [shelfCountSummary, setShelfCountSummary] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dutyName = shiftDisplayName(onDuty)

  const load = () => {
    setChecking(true)
    setError('')
    fetchOnDutyShift('Shelf')
      .then((duty) => {
        setOnDuty(duty)
        onDutyChange?.(duty)
      })
      .catch((err) => {
        setOnDuty(null)
        onDutyChange?.(null)
        setError(err?.message || 'Không kiểm tra được ca làm việc.')
      })
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    if (bypass) {
      onDutyChange?.(BYPASSED_DUTY)
      setChecking(false)
      return undefined
    }
    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bypass])

  const handleOpenCash = async () => {
    if (!bypass && !onDuty) {
      showError('Chỉ mở ca khi đã được duyệt ca quầy và đang trong giờ làm.')
      return
    }
    if (!shelfChecked) {
      showError('Vui lòng xác nhận đã kiểm hàng hóa trên kệ đầu ca.')
      return
    }
    setIsSubmitting(true)
    try {
      const shelfPart = [
        'Kiểm kệ đầu ca: đã xác nhận.',
        shelfCountSummary.trim(),
        shelfNote.trim(),
      ]
        .filter(Boolean)
        .join(' ')
      const noteParts = [shelfPart, openNote.trim()].filter(Boolean)
      await openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: noteParts.join(' | '),
        openedByName: sellerName,
        openedByRole: sellerRole,
        shiftSlotId: onDuty?.slotId || null,
        shiftLabel: dutyName || null,
      })
      showSuccess(dutyName ? `Đã mở ca · ${dutyName}` : 'Đã mở ca — có thể bán tại quầy.')
      onCashOpened?.()
    } catch (err) {
      showError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const dutyOk = bypass || Boolean(onDuty)
  const needsCash = requireCashSession && !cashSessionOpen && dutyOk

  if (checking && !bypass && !onDuty) {
    return (
      <GateShell>
        <GateCard eyebrow="Vui lòng chờ" title="Đang kiểm tra ca làm việc…">
          <p className="text-center text-sm text-slate-500">Một lát nữa sẽ cập nhật trạng thái ca của bạn.</p>
        </GateCard>
      </GateShell>
    )
  }

  if (!dutyOk) {
    return (
      <GateShell>
        <GateCard
          eyebrow="Chưa đủ điều kiện dùng POS"
          title="Cần đăng ký & được duyệt ca quầy"
          body={
            error
            || 'Bạn chưa có ca quầy đã duyệt trong giờ hiện tại (±30 phút). POS bị khóa cho đến khi Manager duyệt ca của bạn.'
          }
        >
          <Link
            to="/my-shifts"
            className="flex w-full items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b]"
          >
            Tới «Lịch làm việc»
          </Link>
          <button
            type="button"
            onClick={load}
            className="w-full rounded-xl border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Kiểm tra lại
          </button>
        </GateCard>
      </GateShell>
    )
  }

  if (needsCash) {
    return (
      <GateShell>
        <GateCard
          wide
          eyebrow="Mở ca làm việc"
          eyebrowTone="green"
          title="Kiểm tiền & hàng kệ đầu ca"
          body="Đối chiếu tồn kệ trên hệ thống với hàng thực tế, rồi nhập tiền đầu két."
        >
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-0.5">
            <div className="rounded-xl border border-[#e7e8e0] bg-[#fbf9f1] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#538463]">1. Kiểm tiền</p>
              <label className="mt-2 block text-xs font-semibold text-slate-600">Tiền mặt đầu két</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                inputMode="numeric"
                placeholder="500.000"
                autoFocus
              />
              <label className="mt-2 block text-xs font-semibold text-slate-600">Ghi chú tiền (tuỳ chọn)</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="Tuỳ chọn"
              />
            </div>

            <div className="rounded-xl border border-[#e7e8e0] bg-[#fbf9f1] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#538463]">
                2. Hàng hóa trên kệ đầu ca
              </p>
              <div className="mt-2">
                <PosShelfStockCheckList
                  onCountsChange={({ summaryText }) => setShelfCountSummary(summaryText || '')}
                />
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#356647]"
                  checked={shelfChecked}
                  onChange={(e) => setShelfChecked(e.target.checked)}
                />
                <span>Đã đối chiếu hàng trên kệ với số lượng hệ thống ở trên.</span>
              </label>
              <label className="mt-2 block text-xs font-semibold text-slate-600">
                Ghi chú lệch / thiếu (tuỳ chọn)
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={shelfNote}
                onChange={(e) => setShelfNote(e.target.value)}
                placeholder="VD: thiếu hàng…"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting || !shelfChecked}
            onClick={handleOpenCash}
            className="mt-1 w-full rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
          >
            {isSubmitting ? 'Đang mở…' : 'Mở ca & vào POS'}
          </button>
          {canCod && typeof onSwitchToCod === 'function' ? (
            <button
              type="button"
              onClick={onSwitchToCod}
              className="w-full rounded-xl border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Không mở ca — chuyển sang bán COD
            </button>
          ) : null}
        </GateCard>
      </GateShell>
    )
  }

  return children
}
