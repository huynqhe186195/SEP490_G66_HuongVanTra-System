export function hasPermission(session, permission) {
  if (!session?.permissions?.length) return false
  return session.permissions.includes(permission)
}

export function canSimulateOrderCompleted(session) {
  return hasPermission(session, 'CREATE_ORDER')
}
