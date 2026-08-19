import { CORPORATE_CUSTOMERS_ENABLED } from './featureFlags.js'

export const CUSTOMER_SIDEBAR_SECTIONS = [
  { key: 'general', label: 'Phổ thông' },
  { key: 'vip', label: 'VIP' },
  ...(CORPORATE_CUSTOMERS_ENABLED ? [{ key: 'corporate', label: 'Doanh nghiệp' }] : []),
  { key: 'debts', label: 'Công nợ' },
  { key: 'inactive', label: 'Ngừng hoạt động' },
]

export function getCustomerSectionFromSearch(search = '') {
  const section = new URLSearchParams(search || '').get('section')
  return CUSTOMER_SIDEBAR_SECTIONS.some((item) => item.key === section) ? section : 'general'
}

export function buildCustomerPath(section = 'general') {
  return `/customers?section=${section}`
}

export function getCustomerSectionLabel(sectionKey) {
  return CUSTOMER_SIDEBAR_SECTIONS.find((item) => item.key === sectionKey)?.label ?? 'Phổ thông'
}
