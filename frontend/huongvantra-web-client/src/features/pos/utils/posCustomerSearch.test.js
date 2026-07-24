import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPosCustomerSearchQuery,
  getCustomerSearchDisplayState,
  isCustomerSearchAbort,
  isExactCustomerPhoneSearch,
  normalizeCustomerSearchPhone,
} from './posCustomerSearch.js'

test('exact phone search is normalized and marked for the server fast path', () => {
  const query = buildPosCustomerSearchQuery({
    search: '090 123 4567',
    customerType: 'VIP',
    pageSize: 20,
  })

  assert.equal(query.get('search'), '090 123 4567')
  assert.equal(query.get('customerType'), 'VIP')
  assert.equal(query.get('exactPhone'), 'true')
  assert.equal(query.get('page'), '1')
  assert.equal(query.get('pageSize'), '20')
})

test('name and customer code searches do not request exact phone mode', () => {
  for (const search of ['Nguyễn An', 'KH000001']) {
    const query = buildPosCustomerSearchQuery({ search })
    assert.equal(query.get('search'), search)
    assert.equal(query.has('exactPhone'), false)
  }
})

test('page size is capped to the backend checkout-search limit', () => {
  const query = buildPosCustomerSearchQuery({ customerType: 'GENERAL', pageSize: 100 })

  assert.equal(query.get('customerType'), 'GENERAL')
  assert.equal(query.get('pageSize'), '50')
})

test('phone normalization and exact-phone recognition agree', () => {
  assert.equal(normalizeCustomerSearchPhone('090-123-4567'), '0901234567')
  assert.equal(isExactCustomerPhoneSearch('090-123-4567'), true)
  assert.equal(isExactCustomerPhoneSearch('028 1234 5678'), true)
  assert.equal(isExactCustomerPhoneSearch('028 123 456'), false)
  assert.equal(isExactCustomerPhoneSearch('090123'), false)
})

test('AbortError is distinguishable from a service failure', () => {
  assert.equal(isCustomerSearchAbort(new DOMException('cancelled', 'AbortError')), true)
  assert.equal(isCustomerSearchAbort(new Error('service unavailable')), false)
})

test('service error and empty result are distinct display states', () => {
  assert.equal(
    getCustomerSearchDisplayState({
      hasCriteria: true,
      isLoading: false,
      error: 'CustomerService unavailable',
      resultCount: 0,
    }),
    'error',
  )
  assert.equal(
    getCustomerSearchDisplayState({
      hasCriteria: true,
      isLoading: false,
      error: '',
      resultCount: 0,
    }),
    'empty',
  )
})
