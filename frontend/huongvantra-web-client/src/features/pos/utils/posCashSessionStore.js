import {
  closeCashSessionApi,
  fetchCurrentCashSession,
  isCashSessionReadyForSale,
  openCashSessionApi,
} from '../services/posCashSessionApi.js'

const EVENT = 'hvt-pos-cash-session'

/** Cache phiên đang mở — BE là nguồn thật; FE giữ cache để gate/assert sync. */
let cachedOpenSession = null
let bootstrapped = false

export function formatVnd(amount) {
  const n = Math.round(Number(amount) || 0)
  return `${n.toLocaleString('vi-VN')} đ`
}

export function loadOpenCashSession() {
  return cachedOpenSession
}

/** true khi có quỹ Open và đúng ca hiện tại (không phải quỹ ca trước còn sót). */
export function isOpenCashSessionReady() {
  return isCashSessionReadyForSale(cachedOpenSession)
}

export function expectedCash(session) {
  if (!session) return 0
  if (session.expectedCash != null && session.status !== 'Open') {
    return Math.round(Number(session.expectedCash) || 0)
  }
  return Math.round(
    Number(session.openingCash || 0)
      + Number(session.cashSalesTotal || 0)
      - Number(session.cashRefundTotal || 0),
  )
}

export function notifyCashSessionChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeCashSession(listener) {
  const handler = () => listener(loadOpenCashSession())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

export async function refreshCashSession() {
  try {
    cachedOpenSession = await fetchCurrentCashSession()
  } catch {
    cachedOpenSession = null
  }
  bootstrapped = true
  notifyCashSessionChanged()
  return cachedOpenSession
}

export async function ensureCashSessionLoaded() {
  if (bootstrapped) return cachedOpenSession
  return refreshCashSession()
}

export async function openCashSession(payload) {
  const session = await openCashSessionApi(payload)
  cachedOpenSession = session
  bootstrapped = true
  notifyCashSessionChanged()
  return session
}

export async function closeCashSession(payload) {
  const closed = await closeCashSessionApi(payload)
  cachedOpenSession = null
  bootstrapped = true
  notifyCashSessionChanged()
  return closed
}

/** BE tự cộng khi tạo đơn tiền mặt — FE chỉ refresh lại totals. */
export async function recordCashSale() {
  return refreshCashSession()
}
