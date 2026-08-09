import { useEffect } from 'react'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  hasActiveOpenCashSession,
  shouldRemindOpenCashSession,
} from '../utils/confirmLeaveIfCashSessionOpen.js'
import {
  ensureCashSessionLoaded,
  loadOpenCashSession,
  refreshCashSession,
  subscribeCashSession,
} from '../utils/posCashSessionStore.js'

/** Nhắc trình duyệt khi Sale đóng tab / tải lại trang mà quỹ còn mở. */
export default function CashSessionUnloadGuard({ enabled = true }) {
  useEffect(() => {
    if (!enabled || !shouldRemindOpenCashSession(loadAuthSession())) return undefined

    ensureCashSessionLoaded()
    const pollId = window.setInterval(() => {
      refreshCashSession().catch(() => {})
    }, 45_000)

    const onBeforeUnload = (event) => {
      if (!hasActiveOpenCashSession(loadOpenCashSession())) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    const unsub = subscribeCashSession(() => {})

    return () => {
      window.clearInterval(pollId)
      window.removeEventListener('beforeunload', onBeforeUnload)
      unsub()
    }
  }, [enabled])

  return null
}
