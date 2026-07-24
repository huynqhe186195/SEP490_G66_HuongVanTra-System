/** Helpers lịch tuần — dữ liệu ca lấy từ API `/api/shifts`. */

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

export function getTemplate(templates, templateId) {
  return templates?.find((t) => t.id === templateId) || null
}
