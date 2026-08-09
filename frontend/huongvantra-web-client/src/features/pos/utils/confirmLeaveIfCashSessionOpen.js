import { confirmDialog } from '../../../app/dialog.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import {
  ensureCashSessionLoaded,
  loadOpenCashSession,
  refreshCashSession,
} from '../utils/posCashSessionStore.js'

/** Manager/Admin không bị nhắc — đóng quỹ là trách nhiệm Sale. */
export function shouldRemindOpenCashSession(auth = loadAuthSession()) {
  return !canViewAllOrders(auth)
}

/**
 * Sale đang có quỹ Open do chính họ mở → nhắc trước khi rời.
 * Không nhắc quỹ của người khác (requiresCloseForNewShift).
 */
export function hasActiveOpenCashSession(session = loadOpenCashSession()) {
  if (!shouldRemindOpenCashSession()) return false
  if (!session) return false
  if (session.status === 'Closed') return false
  if (session.requiresCloseForNewShift || session.canCloseSession === false) return false
  return session.status === 'Open' || Boolean(session.id)
}

/**
 * @returns {Promise<boolean>} true = được phép tiếp tục
 */
export async function confirmLeaveIfCashSessionOpen({ refresh = true } = {}) {
  if (!shouldRemindOpenCashSession()) return true

  const before = loadOpenCashSession()

  if (refresh) {
    try {
      await refreshCashSession()
    } catch {
      // giữ cache
    }
  } else {
    try {
      await ensureCashSessionLoaded()
    } catch {
      // ignore
    }
  }

  if (hasActiveOpenCashSession(loadOpenCashSession()) || hasActiveOpenCashSession(before)) {
    return confirmDialog({
      title: 'Quỹ ca vẫn đang mở',
      message:
        'Bạn chưa đóng quỹ tiền mặt tại quầy. Nên đóng quỹ trước khi đăng xuất hoặc tắt máy.\n\n'
        + 'Nếu quên, nhờ Quản lý đóng quỹ trên «Lịch làm việc» hoặc POS.\n\n'
        + 'Vẫn đăng xuất / rời đi mà chưa đóng quỹ?',
      confirmLabel: 'Vẫn rời đi',
      cancelLabel: 'Ở lại đóng quỹ',
      tone: 'danger',
    })
  }

  return true
}
