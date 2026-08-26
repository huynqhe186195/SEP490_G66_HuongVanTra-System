import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../auth/services/authApi.js'
import { confirmLeaveIfCashSessionOpen } from '../../pos/utils/confirmLeaveIfCashSessionOpen.js'
import { beginAuthLogout, clearAuthSession } from '../../auth/services/authSession.js'
import { clearToasts } from '../../../app/toast.js'
import {
  canUsePosCounterMode,
  canViewAllOrders,
  hasPermission,
  isSaleCodRole,
  isSalePosRole,
  isWarehouseRole,
} from '../../auth/utils/permissions.js'
import {
  fetchShelfDayStocktakeStatus,
  mergeShelfDayStatus,
} from '../../inventory/services/stocktakeApi.js'
import {
  loadOpenCashSession,
  refreshCashSession,
  subscribeCashSession,
} from '../../pos/utils/posCashSessionStore.js'
import { vietnamTodayDateInput } from '../../pos/utils/submitDailyShelfStocktake.js'
import { fetchMyShiftWeekStatus, fetchOnDutyShift } from '../services/shiftsApi.js'

const CHECK_INTERVAL_MS = 60_000
/** Path trang lịch ca (trước đây «Ca của tôi»). */
export const SHIFT_SCHEDULE_PATH = '/my-shifts'
const SCHEDULE_LABEL = 'Lịch làm việc'
const POS_PATH = '/pos'

/**
 * SalePos + SaleCod:
 * - Chưa có ca duyệt tuần (+ không mở đăng ký) → hard block
 * - Đang mở đăng ký → chỉ «Lịch làm việc»
 * - Đã có ca nhưng ngoài giờ ca → chỉ «Lịch làm việc»
 * - SalePos: đã chốt kệ cuối ngày (+ quỹ đóng) → khóa toàn app đến ngày mới
 * - Trong giờ ca → dùng app bình thường
 */
export function needsWeeklyShiftGate(session) {
  if (!session) return false
  // Khớp với StaffShiftGuard ở backend: ai xem được toàn bộ đơn (Manager/Admin/Kế toán)
  // đều không thuộc ca quầy nên không bị gate.
  if (canViewAllOrders(session)) return false
  if (isWarehouseRole(session)) return false
  if (isSalePosRole(session) || isSaleCodRole(session)) return true
  if (hasPermission(session, 'CREATE_ORDER')) return true
  return false
}

function isSchedulePath(pathname) {
  const path = (pathname || '').toLowerCase()
  return path === SHIFT_SCHEDULE_PATH || path.startsWith(`${SHIFT_SCHEDULE_PATH}/`)
}

function isPosPath(pathname) {
  const path = (pathname || '').toLowerCase()
  return path === POS_PATH || path.startsWith(`${POS_PATH}/`)
}

function LockShell({ children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f4f1e8] p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(53,102,71,0.08) 0, transparent 42%), radial-gradient(circle at 80% 80%, rgba(83,132,99,0.1) 0, transparent 40%)',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}

function LockCard({ eyebrow, title, message, children }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-[#c1c9c0]/60 bg-white shadow-sm">
      <div className="border-b border-[#e7e8e0] px-5 py-4">
        <p className="text-xs font-semibold text-[#717971]">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-[#1b1c17]">{title}</h2>
        {message ? <p className="mt-2 text-sm leading-relaxed text-[#717971]">{message}</p> : null}
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">{children}</div>
    </div>
  )
}

function DayEndLockCard({ dateLabel, loggingOut, onLogout, cashStillOpen }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#c1c9c0]/50 bg-white shadow-[0_12px_40px_rgba(27,28,23,0.08)]">
      <div className="h-1.5 w-full bg-[#356647]" aria-hidden />
      <div className="px-7 pb-7 pt-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#538463]">
          Kết thúc ngày làm việc
        </p>
        <h2 className="mt-3 text-2xl font-bold leading-snug text-[#1b1c17]">
          Đã hoàn tất kiểm kê kệ cuối ngày
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#717971]">
          {cashStillOpen
            ? 'Vào POS để đóng quỹ ca trước khi hệ thống khóa hết các chức năng đến ngày mai.'
            : 'Hệ thống đã khóa toàn bộ chức năng của Sale. Quay lại vào ngày làm việc tiếp theo.'}
        </p>
        {dateLabel ? (
          <p className="mt-4 inline-flex rounded-full bg-[#f6f4ec] px-3 py-1 text-xs font-semibold text-[#356647]">
            Ngày {dateLabel}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-2.5">
          {cashStillOpen ? (
            <Link
              to={POS_PATH}
              className="flex w-full items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white transition hover:bg-[#2d553b]"
            >
              Tới POS · Đóng quỹ
            </Link>
          ) : null}
          <button
            type="button"
            disabled={loggingOut}
            onClick={onLogout}
            className="w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] py-3 text-sm font-semibold text-[#414942] transition hover:bg-[#f0eee4] disabled:opacity-60"
          >
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatVnDateLabel(isoDate) {
  const raw = String(isoDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return vietnamTodayDateInput()
  const [y, m, d] = raw.split('-')
  return `${d}/${m}/${y}`
}

/** lockMode: null | 'checking' | 'register_only' | 'hard_block' | 'off_duty' | 'day_end' */
export default function SaleWeeklyShiftGate({ session, children, onLockChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const gateApplies = needsWeeklyShiftGate(session)
  const trackShelfDayEnd =
    gateApplies
    && canUsePosCounterMode(session)
    && !canViewAllOrders(session)

  const [status, setStatus] = useState(null)
  const [onDuty, setOnDuty] = useState(null)
  const [checking, setChecking] = useState(gateApplies)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [dayStatus, setDayStatus] = useState({
    date: null,
    dayStartDone: false,
    dayEndDone: false,
  })
  const [dayStatusReady, setDayStatusReady] = useState(!trackShelfDayEnd)
  const [cashOpen, setCashOpen] = useState(() => Boolean(loadOpenCashSession()))
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // silent=true cho các lần poll định kỳ: bật lại `checking` sẽ unmount toàn bộ children,
  // làm mất modal/form đang mở của người dùng mỗi phút.
  const load = (silent = false) => {
    if (!gateApplies) return
    if (!silent) setChecking(true)
    setError('')
    Promise.all([
      fetchMyShiftWeekStatus().catch((err) => {
        throw err
      }),
      fetchOnDutyShift('Shelf').catch(() => null),
    ])
      .then(([week, duty]) => {
        if (!mountedRef.current) return
        setStatus(week)
        setOnDuty(duty)
        try {
          sessionStorage.setItem(
            'hvt-sale-last-week-gate',
            JSON.stringify({ week, duty }),
          )
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        if (!mountedRef.current) return
        if (!navigator.onLine) {
          try {
            const raw = sessionStorage.getItem('hvt-sale-last-week-gate')
            const cached = raw ? JSON.parse(raw) : null
            if (cached?.week) {
              setStatus(cached.week)
              setOnDuty(cached.duty ?? null)
              setError('')
              return
            }
          } catch {
            // fall through
          }
        }
        setStatus(null)
        setOnDuty(null)
        setError(err?.message || 'Không kiểm tra được ca làm việc.')
      })
      .finally(() => {
        if (!mountedRef.current) return
        setChecking(false)
      })
  }

  const refreshDayStatus = useCallback(async () => {
    if (!trackShelfDayEnd) {
      setDayStatusReady(true)
      return null
    }
    try {
      const next = await fetchShelfDayStocktakeStatus()
      if (!mountedRef.current) return next
      setDayStatus((prev) => mergeShelfDayStatus(prev, next))
      return next
    } catch {
      if (!mountedRef.current) return null
      return null
    } finally {
      if (mountedRef.current) setDayStatusReady(true)
    }
  }, [trackShelfDayEnd])

  const handleLogout = async () => {
    const allowed = await confirmLeaveIfCashSessionOpen()
    if (!allowed) return

    setLoggingOut(true)
    beginAuthLogout()
    clearToasts()
    const accessToken = session?.accessToken
    const refreshToken = session?.refreshToken
    clearAuthSession()
    try {
      await logoutApi(accessToken, refreshToken)
    } catch {
      // clear local anyway
    } finally {
      setLoggingOut(false)
      window.location.replace('/login')
    }
  }

  useEffect(() => {
    if (!gateApplies) {
      setChecking(false)
      onLockChange?.(null)
      return undefined
    }
    load()
    const id = window.setInterval(() => load(true), CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateApplies])

  useEffect(() => {
    if (!trackShelfDayEnd) {
      setDayStatusReady(true)
      return undefined
    }
    setDayStatusReady(false)
    refreshDayStatus()
    const id = window.setInterval(refreshDayStatus, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [trackShelfDayEnd, refreshDayStatus])

  useEffect(() => {
    if (!trackShelfDayEnd) return undefined
    refreshCashSession().then((sessionCash) => {
      if (mountedRef.current) setCashOpen(Boolean(sessionCash))
    })
    return subscribeCashSession((sessionCash) => setCashOpen(Boolean(sessionCash)))
  }, [trackShelfDayEnd])

  const hasApproved = Boolean(status?.hasApprovedShiftThisWeek)
  const canRegisterNow = Boolean(status?.canRegisterNow)
  const hardBlocked = gateApplies && !checking && !hasApproved && !canRegisterNow
  const registerOnly = gateApplies && !checking && !hasApproved && canRegisterNow
  const offDutyOnly = gateApplies && !checking && hasApproved && !onDuty
  const dayEnded = trackShelfDayEnd && dayStatusReady && Boolean(dayStatus.dayEndDone)
  const dayEndLockFull = dayEnded && !cashOpen
  const dayEndNeedsCashClose = dayEnded && cashOpen
  const onSchedule = isSchedulePath(location.pathname)
  const onPos = isPosPath(location.pathname)

  useEffect(() => {
    if (!gateApplies) {
      onLockChange?.(null)
      return
    }
    if (checking || (trackShelfDayEnd && !dayStatusReady)) {
      onLockChange?.('checking')
      return
    }
    if (hardBlocked) {
      onLockChange?.('hard_block')
      return
    }
    if (registerOnly || offDutyOnly) {
      onLockChange?.(registerOnly ? 'register_only' : 'off_duty')
      return
    }
    if (dayEndLockFull || dayEndNeedsCashClose) {
      onLockChange?.('day_end')
      return
    }
    onLockChange?.(null)
  }, [
    gateApplies,
    checking,
    trackShelfDayEnd,
    dayStatusReady,
    hardBlocked,
    registerOnly,
    offDutyOnly,
    dayEndLockFull,
    dayEndNeedsCashClose,
    onLockChange,
  ])

  if (!gateApplies) {
    return children
  }

  if (checking || (trackShelfDayEnd && !dayStatusReady && !hardBlocked && !registerOnly && !offDutyOnly)) {
    return (
      <LockShell>
        <div className="rounded-2xl border border-[#c1c9c0]/50 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-[#717971]">Đang kiểm tra ca làm việc…</p>
        </div>
      </LockShell>
    )
  }

  if (hardBlocked) {
    const message =
      error
      || status?.message
      || 'Bạn chưa có ca duyệt tuần này và hiện không trong thời hạn đăng ký. Chờ Manager mở đăng ký hoặc chỉ định bạn vào ca.'

    return (
      <LockShell>
        <LockCard eyebrow="Hệ thống tạm khóa" title="Chưa được xếp ca tuần này" message={message}>
          <button
            type="button"
            onClick={load}
            className="w-full rounded-lg border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Kiểm tra lại
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="w-full rounded-lg border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#717971] hover:bg-[#f6f4ec] disabled:opacity-60"
          >
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </LockCard>
      </LockShell>
    )
  }

  if (registerOnly && !onSchedule) {
    return <Navigate to={SHIFT_SCHEDULE_PATH} replace />
  }

  if (offDutyOnly && !onSchedule) {
    return (
      <LockShell>
        <LockCard eyebrow="Hệ thống tạm khóa" title="Chưa đến giờ ca làm việc">
          <Link
            to={SHIFT_SCHEDULE_PATH}
            className="flex w-full items-center justify-center rounded-lg bg-[#356647] py-2.5 text-sm font-semibold text-white hover:bg-[#2d553b]"
          >
            Tới «{SCHEDULE_LABEL}»
          </Link>
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="w-full rounded-lg border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#717971] hover:bg-[#f6f4ec] disabled:opacity-60"
          >
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </LockCard>
      </LockShell>
    )
  }

  if (dayEndNeedsCashClose && !onPos) {
    return <Navigate to={POS_PATH} replace />
  }

  if (dayEndLockFull) {
    return (
      <LockShell>
        <DayEndLockCard
          dateLabel={formatVnDateLabel(dayStatus.date)}
          loggingOut={loggingOut}
          onLogout={handleLogout}
          cashStillOpen={false}
        />
      </LockShell>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {registerOnly && onSchedule ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] border-t border-amber-200 bg-amber-50/95 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
          Đang trong thời hạn đăng ký — chỉ dùng được «{SCHEDULE_LABEL}» cho đến khi được duyệt / chỉ định.
        </div>
      ) : null}
      {dayEndNeedsCashClose && onPos ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] border-t border-[#356647]/25 bg-[#e8f2eb]/95 px-4 py-2.5 text-center text-xs font-semibold text-[#1d3d2a] sm:text-sm">
          Đã chốt kệ cuối ngày — hãy đóng quỹ ca trên POS để hoàn tất khóa ngày.
        </div>
      ) : null}
    </div>
  )
}
