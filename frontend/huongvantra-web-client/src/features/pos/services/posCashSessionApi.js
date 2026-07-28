import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapCashSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  const status = raw.status ?? raw.Status ?? ''
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    status: status || 'Open',
    openingCash: Number(raw.openingCash ?? raw.OpeningCash ?? 0),
    cashSalesTotal: Number(raw.cashSalesTotal ?? raw.CashSalesTotal ?? 0),
    cashRefundTotal: Number(raw.cashRefundTotal ?? raw.CashRefundTotal ?? 0),
    orderCount: Number(raw.orderCount ?? raw.OrderCount ?? 0),
    note: raw.note ?? raw.Note ?? '',
    openedByName: raw.openedByName ?? raw.OpenedByName ?? '',
    openedByRole: raw.openedByRole ?? raw.OpenedByRole ?? '',
    shiftLabel: raw.shiftLabel ?? raw.ShiftLabel ?? '',
    shiftSlotId: raw.shiftSlotId ?? raw.ShiftSlotId ?? null,
    openedAt: raw.openedAt ?? raw.OpenedAt ?? null,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? null,
    countedCash: raw.countedCash ?? raw.CountedCash ?? null,
    expectedCash: raw.expectedCash ?? raw.ExpectedCash ?? null,
    variance: raw.variance ?? raw.Variance ?? null,
    varianceNote: raw.varianceNote ?? raw.VarianceNote ?? '',
    closedByName: raw.closedByName ?? raw.ClosedByName ?? null,
    closedAt: raw.closedAt ?? raw.ClosedAt ?? null,
  }
}

export function normalizeCashSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  const status = raw.status ?? raw.Status
  if (status && status !== 'Open') return null
  return mapCashSession(raw)
}

export async function fetchCurrentCashSession() {
  const data = await apiRequestAuth('/api/pos/cash-sessions/current')
  const session = data?.session ?? data?.Session ?? null
  return normalizeCashSession(session)
}

export async function fetchCashSessionHistory(params = {}) {
  const query = new URLSearchParams()
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.status) query.set('status', params.status)
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 20))
  const data = await apiRequestAuth(`/api/pos/cash-sessions?${query.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapCashSession).filter(Boolean),
  }
}

export async function openCashSessionApi(payload) {
  const data = await apiRequestAuth('/api/pos/cash-sessions/open', {
    method: 'POST',
    body: JSON.stringify({
      openingCash: payload.openingCash,
      note: payload.note || null,
      shiftSlotId: payload.shiftSlotId || null,
      shiftLabel: payload.shiftLabel || null,
      openedByName: payload.openedByName || null,
      openedByRole: payload.openedByRole || null,
    }),
  })
  return normalizeCashSession(data)
}

export async function closeCashSessionApi({ countedCash, varianceNote }) {
  const data = await apiRequestAuth('/api/pos/cash-sessions/current/close', {
    method: 'POST',
    body: JSON.stringify({
      countedCash,
      varianceNote: varianceNote || null,
    }),
  })
  if (!data) return null
  return {
    ...mapCashSession({ ...data, status: 'Closed' }),
    status: 'Closed',
  }
}
