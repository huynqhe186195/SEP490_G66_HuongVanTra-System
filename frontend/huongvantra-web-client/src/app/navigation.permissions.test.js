import assert from 'node:assert/strict'
import test from 'node:test'

import { canAccessModule, canAccessPath, getNavigationItemsForSession, isNavigationItemActive } from './navigation.js'

function collectPaths(items, acc = []) {
  for (const item of items) {
    if (item.path && !String(item.path).startsWith('__grp_')) acc.push(item.path)
    if (item.children?.length) collectPaths(item.children, acc)
  }
  return acc
}

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

test('Admin sidebar shows Tích hợp like Manager', () => {
  const admin = {
    roles: ['Admin'],
    modules: ['users_admin', 'phan_quyen_admin', 'system_activity_log'],
    permissions: ['MANAGE_ROLE', 'MONITOR_OUTBOX'],
  }
  const items = getNavigationItemsForSession(admin)
  const paths = collectPaths(items)
  assert.equal(paths.includes('/integrations'), true)
  const system = items.find((item) => item.path === '__grp_system')
  const systemPaths = (system?.children ?? []).map((child) => child.path)
  assert.equal(systemPaths.includes('/integrations'), false)
  assert.equal(
    isNavigationItemActive('/admin/inventory-sync', { path: '/integrations', module: 'integrations' }),
    true,
  )
})

test('Manager sidebar shows Tích hợp', () => {
  const manager = {
    roles: ['Manager'],
    modules: ['pos', 'orders'],
    permissions: ['MANAGE_EMPLOYEE', 'MONITOR_OUTBOX', 'VIEW_ORDER'],
  }
  const paths = collectPaths(getNavigationItemsForSession(manager))
  assert.equal(paths.includes('/integrations'), true)
})

test('Manager can open integrations hub and error queue', () => {
  const manager = {
    roles: ['Manager'],
    modules: ['pos', 'orders', 'integrations', 'inventory_sync_monitor'],
    permissions: ['MANAGE_EMPLOYEE', 'MONITOR_OUTBOX', 'VIEW_ORDER'],
  }

  assert.equal(canAccessModule(manager, 'integrations'), true)
  assert.equal(canAccessModule(manager, 'inventory_sync_monitor'), true)
  assert.equal(canAccessPath(manager, '/integrations'), true)
  assert.equal(canAccessPath(manager, '/admin/inventory-sync'), true)
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

test('b2b debts path highlights debts item but not POS orders list', () => {
  const posOrders = { path: '/orders', module: 'orders' }
  const b2bDebts = { path: '/orders/b2b-debts', module: 'orders' }

  assert.equal(isNavigationItemActive('/orders/b2b-debts', b2bDebts), true)
  assert.equal(isNavigationItemActive('/orders/b2b-debts', posOrders), false)
  assert.equal(isNavigationItemActive('/orders', posOrders), true)
  assert.equal(isNavigationItemActive('/orders/cod', posOrders), false)
})
