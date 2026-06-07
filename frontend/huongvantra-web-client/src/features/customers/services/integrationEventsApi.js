import { apiRequestAuth } from '../../../lib/apiClient.js'
import { fetchCustomerById } from './customersApi.js'

export async function simulateOrderCompleted({
  customerId,
  totalAmount,
  debtAmount,
  orderCode,
  orderId,
}) {
  return apiRequestAuth('/api/integration-events/order-completed/simulate', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      totalAmount: Number(totalAmount),
      debtAmount: Number(debtAmount),
      orderCode: orderCode?.trim() || undefined,
      orderId: orderId || undefined,
    }),
  })
}

export async function waitForCustomerAfterIntegrationEvent(
  customerId,
  previousSnapshot,
  { maxAttempts = 10, intervalMs = 1200 } = {},
) {
  const prevSpend = Number(previousSnapshot?.totalSpend ?? 0)
  const prevDebt = Number(previousSnapshot?.currentDebt ?? 0)
  const prevTierId = previousSnapshot?.tierId ?? null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    const customer = await fetchCustomerById(customerId)
    const spendChanged = Number(customer.totalSpend) !== prevSpend
    const debtChanged = Number(customer.currentDebt) !== prevDebt
    const tierChanged = (customer.tier?.tierId ?? customer.tierId ?? null) !== prevTierId

    if (spendChanged || debtChanged || tierChanged) {
      return customer
    }
  }

  return fetchCustomerById(customerId)
}
