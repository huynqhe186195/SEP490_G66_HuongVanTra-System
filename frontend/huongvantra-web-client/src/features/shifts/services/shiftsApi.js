import { apiRequestAuth } from '../../../lib/apiClient.js'

function normalizeTemplate(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: raw.name ?? raw.Name ?? '',
    area: raw.area ?? raw.Area ?? '',
    areaLabel: raw.areaLabel ?? raw.AreaLabel ?? '',
    start: raw.start ?? raw.Start ?? '',
    end: raw.end ?? raw.End ?? '',
    capacity: Number(raw.capacity ?? raw.Capacity ?? 0),
    color: raw.color ?? raw.Color ?? '#356647',
  }
}

function normalizeAssignment(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    staffId: String(raw.staffId ?? raw.StaffId ?? ''),
    name: raw.name ?? raw.Name ?? '',
    role: raw.role ?? raw.Role ?? '',
    status: raw.status ?? raw.Status ?? 'Pending',
  }
}

function normalizeSlot(raw) {
  if (!raw || typeof raw !== 'object') return null
  const assignments = (raw.assignments ?? raw.Assignments ?? [])
    .map(normalizeAssignment)
    .filter(Boolean)
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    templateId: String(raw.templateId ?? raw.TemplateId ?? ''),
    workDate: raw.workDate ?? raw.WorkDate ?? '',
    status: raw.status ?? raw.Status ?? 'Open',
    assignments,
  }
}

export async function fetchShiftWeek({ weekStart, area } = {}) {
  const params = new URLSearchParams()
  if (weekStart) params.set('weekStart', weekStart)
  if (area) params.set('area', area)
  const qs = params.toString()
  const data = await apiRequestAuth(`/api/shifts/week${qs ? `?${qs}` : ''}`)
  return {
    weekStart: data.weekStart ?? data.WeekStart ?? weekStart,
    weekEnd: data.weekEnd ?? data.WeekEnd ?? '',
    templates: (data.templates ?? data.Templates ?? []).map(normalizeTemplate).filter(Boolean),
    slots: (data.slots ?? data.Slots ?? []).map(normalizeSlot).filter(Boolean),
  }
}

export async function registerShiftSlot(slotId) {
  const data = await apiRequestAuth(`/api/shifts/slots/${slotId}/register`, { method: 'POST' })
  return normalizeAssignment(data)
}

export async function approveShiftRegistration(registrationId) {
  await apiRequestAuth(`/api/shifts/registrations/${registrationId}/approve`, { method: 'POST' })
}

export async function rejectShiftRegistration(registrationId) {
  await apiRequestAuth(`/api/shifts/registrations/${registrationId}/reject`, { method: 'POST' })
}

/** Ca quầy đã duyệt đang trong giờ (±30 phút). Null nếu chưa đủ điều kiện mở ca quỹ. */
export async function fetchOnDutyShift(area = 'Shelf') {
  const params = new URLSearchParams()
  if (area) params.set('area', area)
  const data = await apiRequestAuth(`/api/shifts/me/on-duty?${params}`)
  const raw = data?.onDuty ?? data?.OnDuty ?? null
  if (!raw) return null
  return {
    slotId: String(raw.slotId ?? raw.SlotId ?? ''),
    templateId: String(raw.templateId ?? raw.TemplateId ?? ''),
    templateName: raw.templateName ?? raw.TemplateName ?? '',
    area: raw.area ?? raw.Area ?? '',
    workDate: raw.workDate ?? raw.WorkDate ?? '',
    start: raw.start ?? raw.Start ?? '',
    end: raw.end ?? raw.End ?? '',
    label: raw.label ?? raw.Label ?? '',
  }
}
