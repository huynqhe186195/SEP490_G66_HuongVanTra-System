import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canCompleteBackorderRefund,
  canCreateOrder,
  canEditAccountingSalePrice,
  canReviewBackorderRefund,
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

test('Manager keeps both create modes; Admin is blocked from POS ops', () => {
  const manager = session('CREATE_POS_ORDER', 'CREATE_COD_ORDER', 'MANAGE_EMPLOYEE', 'VERIFY_COD')
  assert.equal(canUsePosCounterMode(manager), true)
  assert.equal(canUsePosCodMode(manager), true)
  assert.equal(canViewOnlyCodOrders(manager), false)

  const admin = {
    roles: ['Admin'],
    permissions: ['CREATE_POS_ORDER', 'CREATE_COD_ORDER', 'MANAGE_ROLE', 'VERIFY_COD'],
  }
  assert.equal(canUsePosCounterMode(admin), false)
  assert.equal(canUsePosCodMode(admin), false)
  assert.equal(canVerifyCodPayment(admin), false)
})

test('backorder refund separates approval from evidence recording', () => {
  const manager = { roles: ['Manager'], permissions: [] }
  const accountant = { roles: ['Accountant'], permissions: [] }
  const admin = { roles: ['Admin'], permissions: ['MANAGE_ROLE'] }

  assert.equal(canReviewBackorderRefund(manager), true)
  assert.equal(canCompleteBackorderRefund(manager), true)
  assert.equal(canReviewBackorderRefund(accountant), false)
  assert.equal(canCompleteBackorderRefund(accountant), true)
  assert.equal(canReviewBackorderRefund(admin), false)
  assert.equal(canCompleteBackorderRefund(admin), false)
})

test('Manager catalog or Accountant cost permission can edit the direct retail sale price', () => {
  const manager = { roles: ['Manager'], permissions: ['MANAGE_CATALOG', 'VIEW_COST'] }
  const accountant = { roles: ['Accountant'], permissions: ['MANAGE_COST', 'VIEW_COST'] }
  const admin = { roles: ['Admin'], permissions: ['MANAGE_CATALOG', 'VIEW_COST'] }

  assert.equal(canEditAccountingSalePrice(manager), true)
  assert.equal(canEditAccountingSalePrice(accountant), true)
  assert.equal(canEditAccountingSalePrice(admin), false)
})
