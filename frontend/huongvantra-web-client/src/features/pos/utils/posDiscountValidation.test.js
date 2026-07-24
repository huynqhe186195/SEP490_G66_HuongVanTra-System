import assert from 'node:assert/strict'
import test from 'node:test'

import { validateZeroTotalCheckout } from './posDiscountValidation.js'

test('rejects an ordinary zero-priced sale line', () => {
  const result = validateZeroTotalCheckout({
    items: [{ unitPrice: 0, isGift: false }],
    finalAmount: 0,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /đơn giá lớn hơn 0/)
})

test('rejects an obvious zero-total order without promotion or VIP gifts', () => {
  const result = validateZeroTotalCheckout({
    items: [{ unitPrice: 10_000, isGift: false }],
    finalAmount: 0,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /khuyến mãi hợp lệ/)
})

test('does not block a zero-total order with an applied promotion', () => {
  const result = validateZeroTotalCheckout({
    items: [{ unitPrice: 10_000, isGift: false }],
    finalAmount: 0,
    hasAppliedPromotion: true,
  })

  assert.equal(result.ok, true)
})

test('does not block a pure VIP gift order', () => {
  const result = validateZeroTotalCheckout({
    items: [{ unitPrice: 0, isGift: true }],
    finalAmount: 0,
    isVipCustomer: true,
  })

  assert.equal(result.ok, true)
})
