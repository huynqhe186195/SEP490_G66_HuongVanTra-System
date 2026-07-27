import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../auth/services/authApi.js'
import { clearAuthSession } from '../../auth/services/authSession.js'
import {
  hasPermission,
  isSaleCodRole,
  isSalePosRole,
  isWarehouseRole,
} from '../../auth/utils/permissions.js'
import { fetchMyShiftWeekStatus, fetchOnDutyShift } from '../services/shiftsApi.js'

const CHECK_INTERVAL_MS = 60_000
/** Path trang lịch ca (trước đây «Ca của tôi»). */
export const SHIFT_SCHEDULE_PATH = '/my-shifts'
const SCHEDULE_LABEL = 'Lịch làm việc'

/**
 * SalePos + SaleCod:
 * - Chưa có ca duyệt tuần (+ không mở đăng ký) → hard block
 * - Đang mở đăng ký → chỉ «Lịch làm việc»
 * - Đã có ca nhưng ngoài giờ ca → chỉ «Lịch làm việc»
 * - Trong giờ ca → dùng app bình thường
 */
export function needsWeeklyShiftGate(session) {
  if (!session) return false
  if (hasPermission(session, 'MANAGE_EMPLOYEE')) return false
  if (hasPermission(session, 'MANAGE_ROLE')) return false
  if (isWarehouseRole(session)) return false
  if (isSalePosRole(session) || isSaleCodRole(session)) return true
  if (hasPermission(session, 'CREATE_ORDER')) return true
  return false
}

function isSchedulePath(pathname) {
  const path = (pathname || '').toLowerCase()
  return path === SHIFT_SCHEDULE_PATH || path.startsWith(`${SHIFT_SCHEDULE_PATH}/`)
}

function LockShell({ children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#fbf9f1] p-4">
      {children}
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

/** lockMode: null | 'checking' | 'register_only' | 'hard_block' | 'off_duty' */
export default function SaleWeeklyShiftGate({ session, children, onLockChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const gateApplies = needsWeeklyShiftGate(session)

  const [status, setStatus] = useState(null)
  const [onDuty, setOnDuty] = useState(null)
  const [checking, setChecking] = useState(gateApplies)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = () => {
    if (!gateApplies) return
    setChecking(true)
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
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setStatus(null)
        setOnDuty(null)
        setError(err?.message || 'Không kiểm tra được ca làm việc.')
      })
      .finally(() => {
        if (!mountedRef.current) return
        setChecking(false)
      })
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutApi(session?.accessToken, session?.refreshToken)
    } catch {
      // clear local anyway
    } finally {
      clearAuthSession()
      setLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  useEffect(() => {
    if (!gateApplies) {
      setChecking(false)
      onLockChange?.(null)
      return undefined
    }
    load()
    const id = window.setInterval(load, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateApplies])

  const hasApproved = Boolean(status?.hasApprovedShiftThisWeek)
  const canRegisterNow = Boolean(status?.canRegisterNow)
  const hardBlocked = gateApplies && !checking && !hasApproved && !canRegisterNow
  const registerOnly = gateApplies && !checking && !hasApproved && canRegisterNow
  const offDutyOnly = gateApplies && !checking && hasApproved && !onDuty
  const onSchedule = isSchedulePath(location.pathname)

  useEffect(() => {
    if (!gateApplies) {
      onLockChange?.(null)
      return
    }
    if (checking) {
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
    onLockChange?.(null)
  }, [gateApplies, checking, hardBlocked, registerOnly, offDutyOnly, onLockChange])

  if (!gateApplies) {
    return children
  }

  if (checking) {
    return (
      <LockShell>
        <div className="w-full max-w-sm rounded-xl border border-[#c1c9c0]/60 bg-white px-5 py-6 text-center shadow-sm">
          <p className="text-sm text-[#717971]">Đang kiểm tra ca làm việc…</p>
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

  // Chưa duyệt tuần nhưng đang mở đăng ký → chỉ Lịch làm việc
  if (registerOnly && !onSchedule) {
    return <Navigate to={SHIFT_SCHEDULE_PATH} replace />
  }

  // Đã duyệt tuần nhưng ngoài giờ ca → chỉ Lịch làm việc (xem lịch / chờ đến ca)
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

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {registerOnly && onSchedule ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] border-t border-amber-200 bg-amber-50/95 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
          Đang trong thời hạn đăng ký — chỉ dùng được «{SCHEDULE_LABEL}» cho đến khi được duyệt / chỉ định.
        </div>
      ) : null}
    </div>
  )
}
