export const CUSTOMER_TYPE_BY_TAB = {
  general: 'GENERAL',
  vip: 'VIP',
  corporate: 'CORPORATE',
}

export const DEFAULT_MEMBERSHIP_TIER = 'Member'

export function customerHasTier(customer) {
  if (!customer) return false
  return Boolean(customer.tierId) || Boolean(String(customer.tierCode || '').trim())
}

export function getMembershipTierLabel(customer) {
  const code = String(customer?.tierCode || '').trim()
  return code || DEFAULT_MEMBERSHIP_TIER
}

export function isMemberTierCustomer(customer) {
  if (!customer) return false
  if (!customerHasTier(customer)) return true
  return getMembershipTierLabel(customer).toLowerCase() === DEFAULT_MEMBERSHIP_TIER.toLowerCase()
}

export function formatVnd(value) {
  const amount = Number(value) || 0
  return `${amount.toLocaleString('vi-VN')} VND`
}

export function formatDebtVnd(value) {
  const amount = Number(value) || 0
  if (amount <= 0) return '0 VND'
  return `${amount.toLocaleString('vi-VN')} VND`
}

export function getDebtClass(amount) {
  return Number(amount) > 0 ? 'font-bold text-[#7e5700]' : 'text-[#717971]'
}

export function isAdminSession(session) {
  return (session?.roles ?? []).some((role) => String(role).toLowerCase() === 'admin')
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

export function isVipCustomerType(customerType) {
  const normalized = String(customerType || '').toUpperCase()
  return normalized === 'VIP' || normalized === 'VVIP'
}

export function supportsMembershipTierForCustomerType(customerType) {
  const normalized = String(customerType || '').toUpperCase()
  return normalized === 'GENERAL' || normalized === 'RETAIL'
}

export function getTierClass(tierCode) {
  const code = (tierCode || '').toUpperCase()
  if (code.includes('GOLD')) return 'bg-[#fec25b] text-[#744f00]'
  if (code.includes('SILVER')) return 'bg-[#e4e3db] text-[#414942] border border-[#c1c9c0]'
  if (code.includes('BRONZE')) return 'bg-[#e8c4a8] text-[#5c3d1e]'
  if (code.includes('PLATINUM')) return 'bg-[#baefc8] text-[#00210f]'
  return 'bg-[#627b59]/20 text-[#4a6242]'
}

export function getStatusDisplay(status) {
  const normalized = (status || '').toUpperCase()
  if (normalized === 'ACTIVE') {
    return { label: 'Đang hoạt động', className: 'bg-[#627b59] text-[#f8ffef]' }
  }
  return { label: 'Ngừng hoạt động', className: 'bg-[#ffdad6] text-[#93000a]' }
}

export function customerTypeFromTab(tabKey) {
  if (tabKey === 'corporate') return 'CORPORATE'
  if (tabKey === 'vip') return 'VIP'
  return 'GENERAL'
}

export function supportsMembershipTierForTab(tabKey) {
  return tabKey === 'general'
}

export function generateCustomerCode(tabKey) {
  if (tabKey === 'corporate') return `CORP-${Date.now()}`
  if (tabKey === 'vip') return `VIP-${Date.now()}`
  return `KH-${Date.now()}`
}

export function tabKeyFromCustomerType(customerType) {
  const normalized = String(customerType || '').toUpperCase()
  if (normalized === 'CORPORATE') return 'corporate'
  if (normalized === 'VIP' || normalized === 'VVIP') return 'vip'
  // GENERAL, RETAIL và loại lẻ khác → tab phổ thông
  return 'general'
}

export function customerTypeLabel(tabKey) {
  if (tabKey === 'corporate') return 'Khách doanh nghiệp'
  if (tabKey === 'vip') return 'Khách VIP'
  if (tabKey === 'inactive') return 'Khách đã ngừng HĐ'
  return 'Khách phổ thông'
}

export function customerTypeLabelFromType(customerType) {
  return customerTypeLabel(tabKeyFromCustomerType(customerType))
}
