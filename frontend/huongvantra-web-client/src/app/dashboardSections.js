export const DASHBOARD_SECTIONS = [
  { key: 'overview', label: 'Tổng quan chỉ số' },
  { key: 'sales-growth', label: 'Tăng trưởng bán hàng' },
  { key: 'customer-growth', label: 'Tăng trưởng khách hàng' },
]

export function getDashboardSectionFromSearch(search = '') {
  const section = new URLSearchParams(search || '').get('section')
  return DASHBOARD_SECTIONS.some((item) => item.key === section) ? section : 'overview'
}

export function buildDashboardPath(section = 'overview') {
  return `/dashboard?section=${section}`
}

export function getDashboardSectionLabel(sectionKey) {
  return DASHBOARD_SECTIONS.find((item) => item.key === sectionKey)?.label ?? 'Tổng quan chỉ số'
}
