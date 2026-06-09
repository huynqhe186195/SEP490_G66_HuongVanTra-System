export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

export function canSimulateOrderCompleted(session) {
  return hasPermission(session, 'CREATE_ORDER')
}

export function canManageProducts(session) {
  return hasPermission(session, 'MANAGE_ROLE')
}

export function canViewOrders(session) {
  return hasPermission(session, 'VIEW_ORDER')
}

export function canCreateOrder(session) {
  return hasPermission(session, 'CREATE_ORDER')
}

export function canAdjustStoreStock(session) {
  return hasPermission(session, 'VIEW_ORDER') || hasPermission(session, 'MANAGE_ROLE')
}
