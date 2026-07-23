/** Prototype UI — mock data, chưa nối API. */

export const SHIFT_TEMPLATES = [
  {
    id: 'tpl-shelf-morning',
    name: 'Ca sáng quầy',
    area: 'Shelf',
    areaLabel: 'Quầy',
    start: '08:00',
    end: '12:00',
    capacity: 2,
    color: '#356647',
  },
  {
    id: 'tpl-shelf-afternoon',
    name: 'Ca chiều quầy',
    area: 'Shelf',
    areaLabel: 'Quầy',
    start: '13:00',
    end: '21:00',
    capacity: 2,
    color: '#4e7f5e',
  },
  {
    id: 'tpl-warehouse-day',
    name: 'Ca kho',
    area: 'Warehouse',
    areaLabel: 'Kho',
    start: '08:00',
    end: '17:00',
    capacity: 1,
    color: '#6b5b4a',
  },
]

export const MOCK_STAFF = [
  { id: 'u-sale01', name: 'Nguyen Van Sale', role: 'SalePos', area: 'Shelf' },
  { id: 'u-salecod', name: 'Tran Thi Sale COD', role: 'SaleCod', area: 'Shelf' },
  { id: 'u-wh', name: 'Nguyen Van Kho', role: 'Warehouse', area: 'Warehouse' },
]

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Thứ 2 → CN của tuần chứa `base` (+ weekOffset). */
export function getWeekDays(weekOffset = 0, base = new Date()) {
  const start = new Date(base)
  start.setHours(12, 0, 0, 0)
  start.setDate(start.getDate() + weekOffset * 7)
  const day = start.getDay() // 0=CN
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toIsoDate(d)
    return {
      iso,
      label: DAY_LABELS[d.getDay()],
      dayNum: d.getDate(),
      monthNum: d.getMonth() + 1,
      isToday: iso === toIsoDate(new Date()),
    }
  })
}

export function formatWeekRange(weekDays) {
  if (!weekDays?.length) return ''
  const a = weekDays[0]
  const b = weekDays[6]
  return `${a.dayNum}/${a.monthNum} – ${b.dayNum}/${b.monthNum}`
}

/**
 * Sinh lưới ca cả tuần: mỗi (ngày × mẫu ca) một slot.
 * Một số ô có sẵn người để demo duyệt.
 */
export function buildMockWeekSlots(weekDays) {
  const days = weekDays?.length ? weekDays.map((d) => d.iso) : getWeekDays().map((d) => d.iso)
  const today = toIsoDate(new Date())
  const slots = []

  days.forEach((workDate, dayIndex) => {
    SHIFT_TEMPLATES.forEach((tpl) => {
      const id = `slot-${workDate}-${tpl.id}`
      let assignments = []
      let status = 'Open'

      // Demo seed: hôm nay + ngày mai có người
      if (workDate === today && tpl.id === 'tpl-shelf-morning') {
        assignments = [
          { staffId: 'u-sale01', name: 'Nguyen Van Sale', role: 'SalePos', status: 'Approved' },
        ]
      }
      if (workDate === today && tpl.id === 'tpl-shelf-afternoon') {
        assignments = [
          { staffId: 'u-salecod', name: 'Tran Thi Sale COD', role: 'SaleCod', status: 'Approved' },
          { staffId: 'u-sale01', name: 'Nguyen Van Sale', role: 'SalePos', status: 'Pending' },
        ]
      }
      if (workDate === today && tpl.id === 'tpl-warehouse-day') {
        assignments = [
          { staffId: 'u-wh', name: 'Nguyen Van Kho', role: 'Warehouse', status: 'Approved' },
        ]
      }
      if (dayIndex === 3 && tpl.id === 'tpl-shelf-afternoon') {
        assignments = []
      }
      if (dayIndex === 3 && tpl.id === 'tpl-warehouse-day') {
        assignments = [
          { staffId: 'u-wh', name: 'Nguyen Van Kho', role: 'Warehouse', status: 'Pending' },
        ]
      }
      // Quá khứ: khóa ca chiều hôm qua nếu có trong tuần
      if (workDate < today && tpl.id === 'tpl-shelf-afternoon' && dayIndex === 0) {
        status = 'Closed'
        assignments = [
          { staffId: 'u-salecod', name: 'Tran Thi Sale COD', role: 'SaleCod', status: 'Approved' },
        ]
      }

      slots.push({ id, templateId: tpl.id, workDate, status, assignments })
    })
  })

  return slots
}

export const MOCK_STOCKTAKE_LINKED = {
  requestCode: 'KK-DEMO-001',
  location: 'Shelf',
  locationLabel: 'Kệ hàng',
  countDate: toIsoDate(new Date()),
  createdByName: 'Tran Thi Sale COD',
  createdByRoleName: 'SaleCod',
  shiftCode: 'CA-CHIEU-QUAY',
  shiftWindow: '13:00 – 21:00',
  onDuty: ['Tran Thi Sale COD', 'Nguyen Van Sale (chờ duyệt)'],
  status: 'PendingApproval',
}

export function getTemplate(templateId) {
  return SHIFT_TEMPLATES.find((t) => t.id === templateId) || null
}

export function formatWorkDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function shortName(fullName) {
  if (!fullName) return '—'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return parts.slice(-2).join(' ')
}

export function assignmentStatusLabel(status) {
  if (status === 'Approved') return 'Đã duyệt'
  if (status === 'Pending') return 'Chờ duyệt'
  if (status === 'Rejected') return 'Từ chối'
  return status || '—'
}

export function findSlot(slots, workDate, templateId) {
  return slots.find((s) => s.workDate === workDate && s.templateId === templateId) || null
}
