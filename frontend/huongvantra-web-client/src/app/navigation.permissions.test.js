import assert from 'node:assert/strict'
import test from 'node:test'

import { canAccessModule, canAccessPath } from './navigation.js'

test('SaleCod-only navigation exposes COD POS and COD operations but not normal order list', () => {
  const saleCod = {
    roles: ['SaleCod'],
    modules: ['pos', 'cod_ops', 'orders'],
    permissions: ['CREATE_COD_ORDER', 'VERIFY_COD', 'VIEW_ORDER'],
  }

  assert.equal(canAccessModule(saleCod, 'pos'), true)
  assert.equal(canAccessModule(saleCod, 'cod_ops'), true)
  assert.equal(canAccessModule(saleCod, 'orders'), false)
  assert.equal(canAccessPath(saleCod, '/orders/cod'), true)
})

test('dual sale navigation exposes normal orders and COD operations', () => {
  const dual = {
    roles: ['SalePos', 'SaleCod'],
    modules: ['pos', 'orders', 'cod_ops'],
    permissions: [
      'CREATE_POS_ORDER',
      'CREATE_COD_ORDER',
      'VIEW_ORDER',
      'VERIFY_COD',
    ],
  }

  assert.equal(canAccessModule(dual, 'pos'), true)
  assert.equal(canAccessModule(dual, 'orders'), true)
  assert.equal(canAccessModule(dual, 'cod_ops'), true)
  assert.equal(canAccessPath(dual, '/orders'), true)
  assert.equal(canAccessPath(dual, '/orders/cod'), true)
})

test('SalePos-only navigation denies COD operations', () => {
  const salePos = {
    roles: ['SalePos'],
    modules: ['pos', 'orders', 'cod_ops'],
    permissions: ['CREATE_POS_ORDER', 'VIEW_ORDER'],
  }

  assert.equal(canAccessModule(salePos, 'pos'), true)
  assert.equal(canAccessModule(salePos, 'orders'), true)
  assert.equal(canAccessModule(salePos, 'cod_ops'), false)
  assert.equal(canAccessPath(salePos, '/orders/cod'), false)
})
