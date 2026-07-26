import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canUsePosCodMode, canViewAllOrders } from '../../auth/utils/permissions.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { shiftDisplayName } from '../utils/shiftDisplayName.js'
import { openCashSession } from '../utils/posCashSessionStore.js'
import PosShelfStockCheckList from './PosShelfStockCheckList.jsx'
import { submitShiftOpenShelfStocktake } from '../utils/submitShiftOpenShelfStocktake.js'

const BYPASSED_DUTY = { bypassed: true }

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

function GateShell({ children, fill = false }) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:rounded-[28px] ${
        fill ? '' : 'items-center justify-center p-4'
      }`}
    >
      {children}
    </div>
  )
}

function GateCard({ eyebrow, eyebrowTone = 'amber', title, body, children }) {
  const eyebrowClass =
    eyebrowTone === 'rose'
      ? 'text-rose-700'
      : eyebrowTone === 'green'
        ? 'text-[#538463]'
        : 'text-amber-700'
  return (
    <div className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/40 bg-white shadow-2xl">
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
 * Cổng vào POS:
 * 1) Chưa trong ca quầy → khóa
 * 2) Trong ca nhưng chưa mở quỹ → màn FULL kiểm kệ + kiểm tiền (bắt buộc trước POS)
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
  const [shelfCounts, setShelfCounts] = useState({
    items: [],
    filledCount: 0,
    totalCount: 0,
    summaryText: '',
  })
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
      const stocktake = await submitShiftOpenShelfStocktake({
        items: shelfCounts.items,
        filledCount: shelfCounts.filledCount,
        totalCount: shelfCounts.totalCount,
        shelfNote,
        shiftLabel: dutyName,
      })
      const shelfPart = [
        `Phiếu kiểm kê ${stocktake.requestCode} (đã gửi duyệt).`,
        shelfCounts.summaryText.trim(),
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
      showSuccess(
        `Đã mở ca và gửi phiếu kiểm kê ${stocktake.requestCode}. Manager duyệt tại Kiểm kê tồn kho.`,
      )
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
      <GateShell fill>
        <div className="flex h-full min-h-0 flex-1 flex-col bg-[#f6f4ec]">
          <header className="shrink-0 border-b border-[#c1c9c0]/60 bg-white px-5 py-4 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Đầu ca bắt buộc</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Kiểm kệ & kiểm tiền trước khi vào POS
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Hoàn tất đối chiếu hàng trên kệ và nhập tiền đầu két. Sau khi xác nhận mới vào màn bán hàng.
            </p>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex min-h-0 flex-col border-b border-[#c1c9c0]/50 bg-white p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[#356647]">Hàng hóa trên kệ đầu ca</h2>
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
                <span>Đã đối chiếu hàng trên kệ với số lượng hệ thống.</span>
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={shelfNote}
                onChange={(e) => setShelfNote(e.target.value)}
                placeholder="Ghi chú lệch / thiếu (tuỳ chọn)"
              />
            </section>

            <aside className="flex min-h-0 flex-col gap-4 bg-[#fbf9f1] p-4 sm:p-6">
              <div className="rounded-2xl border border-[#e7e8e0] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#538463]">Kiểm tiền</p>
                <label className="mt-3 block text-xs font-semibold text-slate-600">Tiền mặt đầu két</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  inputMode="numeric"
                  placeholder="500.000"
                  autoFocus
                />
                <label className="mt-3 block text-xs font-semibold text-slate-600">Ghi chú tiền (tuỳ chọn)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  placeholder="VD: đổi tiền lẻ…"
                />
              </div>

              <div className="rounded-2xl border border-[#e7e8e0] bg-white p-4 text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-800">Sau khi mở ca</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                  <li>Tạo phiếu kiểm kê kệ và gửi Manager duyệt</li>
                  <li>Mở ca quỹ POS — mới được bán tại quầy</li>
                </ul>
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || !shelfChecked}
                  onClick={handleOpenCash}
                  className="w-full rounded-xl bg-[#356647] py-3.5 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
                >
                  {isSubmitting ? 'Đang mở…' : 'Xác nhận đầu ca & vào POS'}
                </button>
                {canCod && typeof onSwitchToCod === 'function' ? (
                  <button
                    type="button"
                    onClick={onSwitchToCod}
                    className="w-full rounded-xl border border-[#c1c9c0] bg-white py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
                  >
                    Không mở ca — chuyển sang bán COD
                  </button>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </GateShell>
    )
  }

  return children
}
