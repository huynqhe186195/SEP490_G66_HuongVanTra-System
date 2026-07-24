import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canCreateOrder,
  canUsePosCodMode,
  canUsePosCounterMode,
  canVerifyCodPayment,
  canViewOnlyCodOrders,
} from './permissions.js'

const session = (...permissions) => ({ permissions })

test('SalePos-only permission set allows counter POS and denies COD actions', () => {
  const salePos = session('CREATE_ORDER', 'CREATE_POS_ORDER', 'VIEW_ORDER')

  assert.equal(canCreateOrder(salePos), true)
  assert.equal(canUsePosCounterMode(salePos), true)
  assert.equal(canUsePosCodMode(salePos), false)
  assert.equal(canVerifyCodPayment(salePos), false)
  assert.equal(canViewOnlyCodOrders(salePos), false)
})

test('SaleCod-only permission set allows COD and denies counter POS', () => {
  const saleCod = session('CREATE_ORDER', 'CREATE_COD_ORDER', 'VIEW_ORDER', 'VERIFY_COD')

  assert.equal(canCreateOrder(saleCod), true)
  assert.equal(canUsePosCounterMode(saleCod), false)
  assert.equal(canUsePosCodMode(saleCod), true)
  assert.equal(canVerifyCodPayment(saleCod), true)
  assert.equal(canViewOnlyCodOrders(saleCod), true)
})

test('dual SalePos and SaleCod permissions produce the action union', () => {
  const dual = session(
    'CREATE_ORDER',
    'CREATE_POS_ORDER',
    'CREATE_COD_ORDER',
    'VIEW_ORDER',
    'VERIFY_COD',
  )

  assert.equal(canUsePosCounterMode(dual), true)
  assert.equal(canUsePosCodMode(dual), true)
  assert.equal(canVerifyCodPayment(dual), true)
  assert.equal(canViewOnlyCodOrders(dual), false)
})

test('VERIFY_COD alone does not imply SaleCod create or COD-only scope', () => {
  const verifier = session('VIEW_ORDER', 'VERIFY_COD')

  assert.equal(canUsePosCounterMode(verifier), false)
  assert.equal(canUsePosCodMode(verifier), false)
  assert.equal(canVerifyCodPayment(verifier), true)
  assert.equal(canViewOnlyCodOrders(verifier), false)
})

test('role names do not override action permissions', () => {
  const misleadingRole = {
    roles: ['SaleCod'],
    permissions: ['CREATE_POS_ORDER', 'VIEW_ORDER'],
  }

  assert.equal(canUsePosCounterMode(misleadingRole), true)
  assert.equal(canUsePosCodMode(misleadingRole), false)
})

test('Manager and Admin permission sets keep both create modes', () => {
  for (const elevated of [
    session('CREATE_POS_ORDER', 'CREATE_COD_ORDER', 'MANAGE_EMPLOYEE', 'VERIFY_COD'),
    session('CREATE_POS_ORDER', 'CREATE_COD_ORDER', 'MANAGE_ROLE', 'VERIFY_COD'),
  ]) {
    assert.equal(canUsePosCounterMode(elevated), true)
    assert.equal(canUsePosCodMode(elevated), true)
    assert.equal(canViewOnlyCodOrders(elevated), false)
  }
})
