export const CUSTOMER_TYPE_BY_TAB = {
  vip: 'VIP',
  corporate: 'CORPORATE',
}

export function formatVnd(value) {
  const amount = Number(value) || 0
  return `${amount.toLocaleString('vi-VN')} VND`
}

export function getInitials(name) {
  if (!name) return '--'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function getTierClass(tierCode) {
  const code = (tierCode || '').toUpperCase()
  if (code.includes('GOLD')) return 'bg-[#fec25b] text-[#744f00]'
  if (code.includes('SILVER')) return 'bg-[#e4e3db] text-[#414942] border border-[#c1c9c0]'
  if (code.includes('PLATINUM')) return 'bg-[#baefc8] text-[#00210f]'
  return 'bg-[#627b59]/20 text-[#4a6242]'
}

export function getStatusDisplay(status) {
  const normalized = (status || '').toUpperCase()
  if (normalized === 'ACTIVE') {
    return { label: 'Active', className: 'bg-[#627b59] text-[#f8ffef]' }
  }
  return { label: 'Inactive', className: 'bg-[#ffdad6] text-[#93000a]' }
}

export function generateCustomerCode(tabKey) {
  const prefix = tabKey === 'corporate' ? 'CORP' : 'VIP'
  return `${prefix}-${Date.now()}`
}

export function tabKeyFromCustomerType(customerType) {
  return String(customerType || '').toUpperCase() === 'CORPORATE' ? 'corporate' : 'vip'
}
