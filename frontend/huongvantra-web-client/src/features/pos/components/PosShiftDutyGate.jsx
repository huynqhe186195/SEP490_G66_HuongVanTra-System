import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canUsePosCodMode,
  canUsePosCounterMode,
  canViewAllOrders,
} from '../../auth/utils/permissions.js'
import { fetchShelfDayStocktakeStatus, mergeShelfDayStatus } from '../../inventory/services/stocktakeApi.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { shiftDisplayName } from '../utils/shiftDisplayName.js'
import { vietnamTodayDateInput } from '../utils/submitDailyShelfStocktake.js'
import PosDailyShelfCountScreen from './PosDailyShelfCountScreen.jsx'

const BYPASSED_DUTY = { bypassed: true }

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
    <div className="w-full max-w-sm rounded-xl border border-[#c1c9c0]/60 bg-white shadow-sm">
      <div className="border-b border-[#e7e8e0] px-5 py-4">
        <p className={`text-xs font-semibold ${eyebrowClass}`}>{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-[#1b1c17]">{title}</h2>
        {body ? <p className="mt-2 text-sm leading-relaxed text-[#717971]">{body}</p> : null}
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">{children}</div>
    </div>
  )
}

/**
 * Cổng vào POS:
 * 1) Chưa trong ca quầy → khóa (SalePos + Sale COD)
 * 2) Chế độ quầy: chưa kiểm kệ đầu ngày → đếm kệ
 * 3) Chế độ quầy: màn chốt kệ cuối ngày (khi bấm nút)
 * 4) Chế độ quầy: đã chốt kệ + quỹ đóng → khóa quầy (COD vẫn vào được nếu đổi mode)
 * Sale COD / chế độ Bán COD: chỉ cần trong ca — không kiểm kệ, không quỹ.
 */
export default function PosShiftDutyGate({
  onDutyChange,
  children,
  cashSessionOpen = false,
  onSwitchToCod,
  onDayStatusChange,
  dayEndRequested = false,
  onDayEndRequestHandled,
  /** true = áp dụng kiểm kệ theo ngày (chỉ khi bán quầy). */
  requireShelfDay = true,
}) {
  const auth = loadAuthSession()
  const bypass = canViewAllOrders(auth)
  const canCod = canUsePosCodMode(auth)
  const canCounter = canUsePosCounterMode(auth)
  const shelfDayApplies = Boolean(requireShelfDay) && canCounter && !bypass

  const [onDuty, setOnDuty] = useState(null)
  const [checking, setChecking] = useState(!bypass)
  const [error, setError] = useState('')
  const [dayStatus, setDayStatus] = useState({
    date: null,
    dayStartDone: bypass,
    dayEndDone: false,
  })
  const [dayStatusLoading, setDayStatusLoading] = useState(false)
  const [showDayEnd, setShowDayEnd] = useState(false)

  const dutyName = shiftDisplayName(onDuty)

  const applyDayStatus = useCallback((status) => {
    setDayStatus((prev) => {
      const next = mergeShelfDayStatus(prev, status)
      onDayStatusChange?.(next)
      return next
    })
  }, [onDayStatusChange])

  const refreshDayStatus = useCallback(async () => {
    if (bypass) {
      const status = { date: vietnamTodayDateInput(), dayStartDone: true, dayEndDone: false }
      setDayStatus(status)
      onDayStatusChange?.(status)
      setDayStatusLoading(false)
      return status
    }
    if (!shelfDayApplies) {
      setDayStatusLoading(false)
      setShowDayEnd(false)
      return null
    }

    setDayStatusLoading(true)
    try {
      const status = await fetchShelfDayStocktakeStatus()
      applyDayStatus(status)
      return status
    } catch (err) {
      setError(err?.message || 'Không kiểm tra được trạng thái kiểm kê ngày.')
      return null
    } finally {
      setDayStatusLoading(false)
    }
  }, [bypass, shelfDayApplies, onDayStatusChange, applyDayStatus])

  const markDayStartDoneLocal = useCallback((stocktake) => {
    setDayStatus((prev) => {
      const next = {
        ...prev,
        date: prev.date || vietnamTodayDateInput(),
        dayStartDone: true,
        dayStartId: stocktake?.id || prev.dayStartId,
        dayStartRequestCode: stocktake?.requestCode || prev.dayStartRequestCode,
      }
      onDayStatusChange?.(next)
      return next
    })
  }, [onDayStatusChange])

  const markDayEndDoneLocal = useCallback((stocktake) => {
    setDayStatus((prev) => {
      const next = {
        ...prev,
        date: prev.date || vietnamTodayDateInput(),
        dayEndDone: true,
        dayEndId: stocktake?.id || prev.dayEndId,
        dayEndRequestCode: stocktake?.requestCode || prev.dayEndRequestCode,
      }
      onDayStatusChange?.(next)
      return next
    })
  }, [onDayStatusChange])

  const loadDuty = useCallback(() => {
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
  }, [onDutyChange])

  useEffect(() => {
    if (bypass) {
      onDutyChange?.(BYPASSED_DUTY)
      setChecking(false)
      const status = { date: vietnamTodayDateInput(), dayStartDone: true, dayEndDone: false }
      setDayStatus(status)
      onDayStatusChange?.(status)
      setDayStatusLoading(false)
      return undefined
    }
    loadDuty()
    const id = window.setInterval(loadDuty, 60_000)
    return () => window.clearInterval(id)
  }, [bypass, loadDuty, onDutyChange, onDayStatusChange])

  useEffect(() => {
    if (bypass) return undefined
    if (!shelfDayApplies) {
      setShowDayEnd(false)
      setDayStatusLoading(false)
      return undefined
    }
    let cancelled = false
    setDayStatusLoading(true)
    fetchShelfDayStocktakeStatus()
      .then((status) => {
        if (cancelled) return
        applyDayStatus(status)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Không kiểm tra được trạng thái kiểm kê ngày.')
      })
      .finally(() => {
        if (!cancelled) setDayStatusLoading(false)
      })

    const id = window.setInterval(() => {
      fetchShelfDayStocktakeStatus()
        .then((status) => applyDayStatus(status))
        .catch(() => {})
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [bypass, shelfDayApplies, applyDayStatus])

  useEffect(() => {
    if (dayEndRequested && shelfDayApplies && !bypass) {
      setShowDayEnd(true)
      onDayEndRequestHandled?.()
    } else if (dayEndRequested && !shelfDayApplies) {
      onDayEndRequestHandled?.()
    }
  }, [dayEndRequested, shelfDayApplies, bypass, onDayEndRequestHandled])

  const dutyOk = bypass || Boolean(onDuty)
  const needsDayStart = shelfDayApplies && !dayStatus.dayStartDone

  if (checking && !bypass && !onDuty) {
    return (
      <GateShell>
        <GateCard eyebrow="Vui lòng chờ" title="Đang kiểm tra ca làm việc…">
          <p className="text-center text-sm text-[#717971]">Một lát nữa sẽ cập nhật trạng thái ca của bạn.</p>
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
            || 'Bạn chưa có ca quầy đã duyệt trong giờ ca hiện tại. POS bị khóa cho đến khi Manager duyệt ca của bạn.'
          }
        >
          <Link
            to="/my-shifts"
            className="flex w-full items-center justify-center rounded-lg bg-[#356647] py-2.5 text-sm font-semibold text-white hover:bg-[#2d553b]"
          >
            Tới «Lịch làm việc»
          </Link>
          <button
            type="button"
            onClick={loadDuty}
            className="w-full rounded-lg border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Kiểm tra lại
          </button>
        </GateCard>
      </GateShell>
    )
  }

  if (shelfDayApplies && dayStatusLoading) {
    return (
      <GateShell>
        <GateCard eyebrow="Vui lòng chờ" title="Đang kiểm tra kiểm kê ngày…">
          <p className="text-center text-sm text-[#717971]">Kiểm tra phiếu đầu ngày / cuối ngày.</p>
        </GateCard>
      </GateShell>
    )
  }

  if (needsDayStart) {
    return (
      <GateShell fill>
        <PosDailyShelfCountScreen
          kind="dayStart"
          shiftLabel={dutyName}
          onDone={async (stocktake) => {
            markDayStartDoneLocal(stocktake)
            await refreshDayStatus()
          }}
          secondaryAction={
            canCod && typeof onSwitchToCod === 'function' ? (
              <button
                type="button"
                onClick={onSwitchToCod}
                className="rounded-xl border border-[#c1c9c0] bg-white px-4 py-3 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
              >
                Không kiểm kệ — chuyển COD
              </button>
            ) : null
          }
        />
      </GateShell>
    )
  }

  if (showDayEnd && shelfDayApplies) {
    return (
      <GateShell fill>
        <PosDailyShelfCountScreen
          kind="dayEnd"
          shiftLabel={dutyName}
          onCancel={() => setShowDayEnd(false)}
          onDone={async (stocktake) => {
            markDayEndDoneLocal(stocktake)
            setShowDayEnd(false)
            await refreshDayStatus()
          }}
        />
      </GateShell>
    )
  }

  // Khóa toàn app sau chốt cuối ngày do SaleWeeklyShiftGate xử lý.
  return children
}
