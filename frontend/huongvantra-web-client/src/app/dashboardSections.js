export const DASHBOARD_SECTIONS = [
  { key: 'overview', label: 'Tổng quan chỉ số' },
  { key: 'top-products', label: 'Top sản phẩm bán chạy' },
  { key: 'by-category', label: 'Báo cáo theo danh mục' },
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
