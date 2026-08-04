/**
 * COD payment meta stored in Payment.CodDebtSettlementJson.
 * Extends debt-settlement payload with expectedCollectedAmount (số tiền dự kiến thu khi giao).
 */

export function buildCodMetaJson({ expectedCollectedAmount, settlement } = {}) {
  const payload = {}
  const expected = Math.round(Number(expectedCollectedAmount || 0))
  if (expected > 0) payload.expectedCollectedAmount = expected

  if (settlement?.payDebtsEnabled) {
    const allocatedAmount = Math.round(Number(settlement.allocatedAmount || 0))
    if (allocatedAmount > 0) {
      const allocations = Array.isArray(settlement.allocations)
        ? settlement.allocations
            .map((row) => ({
              orderId: row.orderId,
              amount: Math.round(Number(row.amount || 0)),
            }))
            .filter((row) => row.orderId && row.amount > 0)
        : []
      payload.payDebtsEnabled = true
      payload.allocatedAmount = allocatedAmount
      payload.allocations = allocations
      payload.creditToCustomer = Math.max(0, Math.round(Number(settlement.creditToCustomer || 0)))
      payload.paymentMethod = settlement.paymentMethod || 'COD'
    }
  }

  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null
}

export function parseExpectedCollectedAmount(value) {
  if (!value) return null
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    if (!data || typeof data !== 'object') return null
    const amount = Math.round(Number(data.expectedCollectedAmount ?? data.ExpectedCollectedAmount ?? 0))
    return amount > 0 ? amount : null
  } catch {
    return null
  }
}

export function serializeCodDebtSettlement(settlement) {
  if (!settlement?.payDebtsEnabled) return null
  const allocatedAmount = Math.round(Number(settlement.allocatedAmount || 0))
  if (allocatedAmount <= 0) return null

  const allocations = Array.isArray(settlement.allocations)
    ? settlement.allocations
        .map((row) => ({
          orderId: row.orderId,
          amount: Math.round(Number(row.amount || 0)),
        }))
        .filter((row) => row.orderId && row.amount > 0)
    : []

  return JSON.stringify({
    payDebtsEnabled: true,
    allocatedAmount,
    allocations,
    creditToCustomer: Math.max(0, Math.round(Number(settlement.creditToCustomer || 0))),
    paymentMethod: settlement.paymentMethod || null,
  })
}

export function parseCodDebtSettlement(value) {
  if (!value) return null
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    if (!data || typeof data !== 'object') return null
    const allocatedAmount = Math.round(Number(data.allocatedAmount || 0))
    if (allocatedAmount <= 0) return null
    const allocations = Array.isArray(data.allocations)
      ? data.allocations
          .map((row) => ({
            orderId: row.orderId ?? row.OrderId,
            amount: Math.round(Number(row.amount ?? row.Amount ?? 0)),
          }))
          .filter((row) => row.orderId && row.amount > 0)
      : []
    return {
      payDebtsEnabled: true,
      allocatedAmount,
      allocations,
      creditToCustomer: Math.max(0, Math.round(Number(data.creditToCustomer || 0))),
      paymentMethod: data.paymentMethod ?? data.PaymentMethod ?? null,
    }
  } catch {
    return null
  }
}
