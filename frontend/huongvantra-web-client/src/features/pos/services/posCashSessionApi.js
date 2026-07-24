import { apiRequestAuth } from '../../../lib/apiClient.js'

export function normalizeCashSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  const status = raw.status ?? raw.Status
  if (status && status !== 'Open') return null
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

export async function fetchCurrentCashSession() {
  const data = await apiRequestAuth('/api/pos/cash-sessions/current')
  const session = data?.session ?? data?.Session ?? null
  return normalizeCashSession(session)
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
  // Closed session — return raw normalized without Open filter
  if (!data) return null
  return {
    ...normalizeCashSession({ ...data, status: 'Open' }),
    status: 'Closed',
    countedCash: data.countedCash ?? data.CountedCash,
    expectedCash: data.expectedCash ?? data.ExpectedCash,
    variance: data.variance ?? data.Variance,
    varianceNote: data.varianceNote ?? data.VarianceNote ?? '',
    closedByName: data.closedByName ?? data.ClosedByName,
    closedAt: data.closedAt ?? data.ClosedAt,
  }
}
