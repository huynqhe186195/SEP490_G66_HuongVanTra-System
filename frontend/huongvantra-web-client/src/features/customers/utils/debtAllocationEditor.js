export function buildFifoAllocationRows(openDebts = [], maxAmount = 0) {
  let remaining = Math.max(0, Number(maxAmount) || 0)
  const rows = []

  for (const debt of openDebts) {
    if (remaining <= 0) break
    const debtRemaining = Number(debt.remainingDebt || 0)
    if (debtRemaining <= 0) continue

    const allocate = Math.min(debtRemaining, remaining)
    if (allocate <= 0) continue

    rows.push({
      orderId: debt.orderId,
      orderCode: debt.orderCode,
      amount: allocate,
    })
    remaining -= allocate
  }

  return {
    rows,
    allocatedTotal: rows.reduce((sum, row) => sum + row.amount, 0),
    unallocated: remaining,
  }
}

export function parseAllocationMoneyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function sumAllocationRows(rows = []) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0)
}

export function clampAllocationAmount({
  nextAmount,
  remainingDebt,
  maxTotal,
  currentTotal,
  currentAmount,
}) {
  const capped = Math.min(Math.max(0, Number(nextAmount) || 0), Math.max(0, Number(remainingDebt) || 0))
  const otherTotal = Math.max(0, currentTotal - currentAmount)
  return Math.min(capped, Math.max(0, maxTotal - otherTotal))
}

export function buildAllocationDraft(openDebts = [], maxAmount = 0, existingRows = []) {
  const existingMap = new Map(existingRows.map((row) => [row.orderId, row]))
  const fifo = buildFifoAllocationRows(openDebts, maxAmount)

  return openDebts.map((debt) => {
    const existing = existingMap.get(debt.orderId)
    const fifoRow = fifo.rows.find((row) => row.orderId === debt.orderId)
    const defaultAmount = fifoRow?.amount ?? 0
    const amount = existing ? Number(existing.amount) || 0 : defaultAmount

    return {
      orderId: debt.orderId,
      orderCode: debt.orderCode,
      originalDebt: Number(debt.originalDebt || 0),
      paidAmount: Number(debt.paidAmount || 0),
      remainingDebt: Number(debt.remainingDebt || 0),
      createdAt: debt.createdAt ?? null,
      amount,
    }
  })
}

export function toAllocationPayload(rows = []) {
  return rows
    .filter((row) => (Number(row.amount) || 0) > 0)
    .map((row) => ({
      orderId: row.orderId,
      amount: Math.round(Number(row.amount) || 0),
    }))
}

export function resolveMaxDebtPayable(excessAmount = 0, customerCurrentDebt = 0) {
  const excess = Math.max(0, Number(excessAmount) || 0)
  const debt = Math.max(0, Number(customerCurrentDebt) || 0)
  if (excess <= 0 || debt <= 0) return 0
  return Math.min(excess, debt)
}

export function clampDebtSettlement(settlement, maxAmount = 0, openDebts = [], excessAmount = null) {
  const excess = Math.max(0, Number(excessAmount ?? maxAmount) || 0)

  if (!settlement?.payDebtsEnabled) {
    return {
      payDebtsEnabled: false,
      allocations: [],
      allocatedAmount: 0,
      creditToCustomer: excess,
    }
  }

  const maxPayable = Math.max(0, Number(maxAmount) || 0)
  if (maxPayable <= 0) {
    return {
      payDebtsEnabled: false,
      allocations: [],
      allocatedAmount: 0,
      creditToCustomer: 0,
    }
  }

  const requested = Array.isArray(settlement.allocations)
    ? settlement.allocations
        .map((row) => ({
          orderId: row.orderId,
          amount: Math.round(Number(row.amount || 0)),
        }))
        .filter((row) => row.orderId && row.amount > 0)
    : []

  const debtMap = new Map(
    (openDebts || []).map((debt) => [debt.orderId, Math.max(0, Number(debt.remainingDebt || 0))]),
  )

  let remaining = maxPayable
  const allocations = []

  for (const row of requested) {
    if (remaining <= 0) break
    const debtRemaining = debtMap.get(row.orderId) ?? row.amount
    const amount = Math.min(row.amount, debtRemaining, remaining)
    if (amount <= 0) continue
    allocations.push({ orderId: row.orderId, amount: Math.round(amount) })
    remaining -= amount
  }

  if (allocations.length === 0) {
    const fifo = buildFifoAllocationRows(openDebts, maxPayable)
    allocations.push(...fifo.rows.map((row) => ({
      orderId: row.orderId,
      amount: Math.round(Number(row.amount || 0)),
    })))
  }

  const allocatedAmount = allocations.reduce((sum, row) => sum + row.amount, 0)
  if (allocatedAmount <= 0) {
    return {
      payDebtsEnabled: false,
      allocations: [],
      allocatedAmount: 0,
      creditToCustomer: excess,
    }
  }

  return {
    payDebtsEnabled: true,
    allocations,
    allocatedAmount,
    creditToCustomer: Math.max(0, excess - allocatedAmount),
  }
}
