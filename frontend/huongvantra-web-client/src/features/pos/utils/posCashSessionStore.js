/** Prototype POS cash shift — localStorage, chưa nối API. */

const STORAGE_KEY = 'hvt.pos.cashSession.v1'
const HISTORY_KEY = 'hvt.pos.cashSessionHistory.v1'

export function formatVnd(amount) {
  const n = Math.round(Number(amount) || 0)
  return `${n.toLocaleString('vi-VN')} đ`
}

export function loadOpenCashSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.id || session.status !== 'Open') return null
    return session
  } catch {
    return null
  }
}

function saveOpenCashSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function pushHistory(closedSession) {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    list.unshift(closedSession)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    /* ignore */
  }
}

export function expectedCash(session) {
  if (!session) return 0
  return Math.round(
    Number(session.openingCash || 0)
      + Number(session.cashSalesTotal || 0)
      - Number(session.cashRefundTotal || 0),
  )
}

/** Prototype: cộng tiền mặt khi thanh toán thành công trên POS. */
export function recordCashSale(amount) {
  const session = loadOpenCashSession()
  if (!session) return null
  const next = {
    ...session,
    cashSalesTotal: Math.round(Number(session.cashSalesTotal || 0) + Math.max(0, Number(amount) || 0)),
    orderCount: Number(session.orderCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  saveOpenCashSession(next)
  return next
}

export function openCashSession({
  openingCash,
  note,
  openedByName,
  openedByRole,
  shiftLabel,
  shiftSlotId,
}) {
  if (loadOpenCashSession()) {
    throw new Error('Đã có ca đang mở. Hãy đóng ca trước.')
  }
  const session = {
    id: crypto.randomUUID?.() || `cash-${Date.now()}`,
    status: 'Open',
    openingCash: Math.round(Math.max(0, Number(openingCash) || 0)),
    cashSalesTotal: 0,
    cashRefundTotal: 0,
    orderCount: 0,
    note: note?.trim() || '',
    openedByName: openedByName || 'Nhân viên POS',
    openedByRole: openedByRole || '',
    shiftLabel: shiftLabel || '',
    shiftSlotId: shiftSlotId || null,
    openedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  saveOpenCashSession(session)
  return session
}

export function closeCashSession({ countedCash, varianceNote, closedByName }) {
  const session = loadOpenCashSession()
  if (!session) throw new Error('Không có ca đang mở.')

  const counted = Math.round(Math.max(0, Number(countedCash) || 0))
  const expected = expectedCash(session)
  const variance = counted - expected
  const closed = {
    ...session,
    status: 'Closed',
    countedCash: counted,
    expectedCash: expected,
    variance,
    varianceNote: varianceNote?.trim() || '',
    closedByName: closedByName || session.openedByName,
    closedAt: new Date().toISOString(),
  }
  saveOpenCashSession(null)
  pushHistory(closed)
  return closed
}

export function subscribeCashSession(listener) {
  const handler = (event) => {
    if (event?.key && event.key !== STORAGE_KEY) return
    listener(loadOpenCashSession())
  }
  window.addEventListener('storage', handler)
  window.addEventListener('hvt-pos-cash-session', handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener('hvt-pos-cash-session', handler)
  }
}

export function notifyCashSessionChanged() {
  window.dispatchEvent(new Event('hvt-pos-cash-session'))
}
