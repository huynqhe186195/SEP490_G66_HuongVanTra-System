import assert from 'node:assert/strict'
import test from 'node:test'

import { createCheckoutAttemptManager } from './checkoutAttempt.js'

function uuidFactory() {
  let sequence = 0
  return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
}

test('reuses one key after a temporary failure for the same checkout attempt', async () => {
  const manager = createCheckoutAttemptManager(uuidFactory())
  const observedKeys = []
  const request = { customerId: null, items: [{ skuId: 'sku-1', quantity: 1 }] }

  await assert.rejects(
    manager.submit(request, (key) => {
      observedKeys.push(key)
      throw new Error('network timeout')
    }),
    /network timeout/,
  )
  await manager.submit(request, async (key) => {
    observedKeys.push(key)
    return { orderId: 'order-1' }
  })

  assert.equal(observedKeys.length, 2)
  assert.equal(observedKeys[0], observedKeys[1])
})

test('prevents double submission while one checkout request is processing', async () => {
  const manager = createCheckoutAttemptManager(uuidFactory())
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  let requestCount = 0
  const request = { items: [{ skuId: 'sku-1', quantity: 1 }] }
  const submitter = async () => {
    requestCount += 1
    await pending
    return { orderId: 'order-1' }
  }

  const first = manager.submit(request, submitter)
  const second = manager.submit(request, submitter)
  release()
  const [firstResult, secondResult] = await Promise.all([first, second])

  assert.equal(requestCount, 1)
  assert.deepEqual(firstResult, secondResult)
})

test('uses a new key after success or when the checkout request changes', async () => {
  const manager = createCheckoutAttemptManager(uuidFactory())
  const observedKeys = []
  const submit = (request) => manager.submit(request, async (key) => {
    observedKeys.push(key)
    return { orderId: `order-${observedKeys.length}` }
  })

  await submit({ items: [{ skuId: 'sku-1', quantity: 1 }] })
  await submit({ items: [{ skuId: 'sku-1', quantity: 1 }] })
  await assert.rejects(
    manager.submit(
      { items: [{ skuId: 'sku-1', quantity: 2 }] },
      (key) => {
        observedKeys.push(key)
        throw new Error('business validation')
      },
    ),
  )
  await submit({ items: [{ skuId: 'sku-1', quantity: 3 }] })

  assert.equal(new Set(observedKeys).size, 4)
})
