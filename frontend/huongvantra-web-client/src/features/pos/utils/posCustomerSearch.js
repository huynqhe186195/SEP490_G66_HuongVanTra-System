export function normalizeCustomerSearchPhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isExactCustomerPhoneSearch(value) {
  const phone = normalizeCustomerSearchPhone(value)
  if (phone.startsWith('02')) return phone.length === 11
  return phone.length === 10 && phone.startsWith('0')
}

export function buildPosCustomerSearchQuery({
  search,
  customerType,
  page = 1,
  pageSize = 20,
} = {}) {
  const query = new URLSearchParams()
  const keyword = String(search ?? '').trim()
  const type = String(customerType ?? '').trim()
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safePageSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20))

  if (keyword) query.set('search', keyword)
  if (type) query.set('customerType', type)
  if (isExactCustomerPhoneSearch(keyword)) query.set('exactPhone', 'true')
  query.set('page', String(safePage))
  query.set('pageSize', String(safePageSize))

  return query
}

export function isCustomerSearchAbort(error) {
  return error?.name === 'AbortError'
}

export function getCustomerSearchDisplayState({
  hasCriteria,
  isLoading,
  error,
  resultCount,
} = {}) {
  if (!hasCriteria) return 'idle'
  if (isLoading) return 'loading'
  if (error) return 'error'
  return Number(resultCount) > 0 ? 'results' : 'empty'
}
