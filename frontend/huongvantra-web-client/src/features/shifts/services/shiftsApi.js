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

function normalizeStaffOption(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    userId: String(raw.userId ?? raw.UserId ?? ''),
    fullName: raw.fullName ?? raw.FullName ?? '',
    roleName: raw.roleName ?? raw.RoleName ?? '',
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

function normalizeWindow(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    weekStart: raw.weekStart ?? raw.WeekStart ?? '',
    weekEnd: raw.weekEnd ?? raw.WeekEnd ?? '',
    opensAt: raw.opensAt ?? raw.OpensAt ?? '',
    closesAt: raw.closesAt ?? raw.ClosesAt ?? '',
    isManuallyClosed: Boolean(raw.isManuallyClosed ?? raw.IsManuallyClosed),
    isOpenNow: Boolean(raw.isOpenNow ?? raw.IsOpenNow),
    status: raw.status ?? raw.Status ?? 'Closed',
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

/** Manager chỉnh giờ khung ca (HH:mm). */
export async function updateShiftTemplateHours(templateId, { start, end }) {
  const data = await apiRequestAuth(`/api/shifts/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify({ start, end }),
  })
  return normalizeTemplate(data)
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

/** Danh sách nhân viên Sale khả dụng để Manager chỉ định vào ca. */
export async function fetchAssignableShiftStaff() {
  const data = await apiRequestAuth('/api/shifts/assignable-staff')
  const list = Array.isArray(data) ? data : []
  return list.map(normalizeStaffOption).filter(Boolean)
}

/** Manager chỉ định trực tiếp một Sale vào ca — được duyệt ngay. */
export async function assignShiftSlot(slotId, userId) {
  const data = await apiRequestAuth(`/api/shifts/slots/${slotId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return normalizeAssignment(data)
}

/** Manager gỡ nhân viên khỏi ca (Pending / Approved). */
export async function unassignShiftRegistration(registrationId) {
  await apiRequestAuth(`/api/shifts/registrations/${registrationId}/unassign`, { method: 'POST' })
}

export async function fetchShiftRegistrationWindow(weekStart) {
  const params = new URLSearchParams({ weekStart })
  const data = await apiRequestAuth(`/api/shifts/registration-windows?${params}`)
  if (!data) return null
  return normalizeWindow(data)
}

export async function upsertShiftRegistrationWindow({ weekStart, opensAt, closesAt }) {
  const data = await apiRequestAuth('/api/shifts/registration-windows', {
    method: 'PUT',
    body: JSON.stringify({ weekStart, opensAt, closesAt }),
  })
  return normalizeWindow(data)
}

export async function closeShiftRegistrationWindow(windowId) {
  const data = await apiRequestAuth(`/api/shifts/registration-windows/${windowId}/close`, {
    method: 'POST',
  })
  return normalizeWindow(data)
}

export async function reopenShiftRegistrationWindow(windowId) {
  const data = await apiRequestAuth(`/api/shifts/registration-windows/${windowId}/reopen`, {
    method: 'POST',
  })
  return normalizeWindow(data)
}

/** Trạng thái đăng ký ca tuần hiện tại — dùng để chặn app nếu Sale chưa có ca đã duyệt tuần này. */
export async function fetchMyShiftWeekStatus() {
  const data = await apiRequestAuth('/api/shifts/me/week-status')
  return {
    weekStart: data.weekStart ?? data.WeekStart ?? '',
    weekEnd: data.weekEnd ?? data.WeekEnd ?? '',
    canRegisterNow: Boolean(data.canRegisterNow ?? data.CanRegisterNow),
    // backward-compat for older FE snippets
    canRegisterToday: Boolean(
      data.canRegisterNow ?? data.CanRegisterNow ?? data.canRegisterToday ?? data.CanRegisterToday,
    ),
    hasApprovedShiftThisWeek: Boolean(data.hasApprovedShiftThisWeek ?? data.HasApprovedShiftThisWeek),
    allowMyShiftsOnly: Boolean(data.allowMyShiftsOnly ?? data.AllowMyShiftsOnly),
    hardBlocked: Boolean(data.hardBlocked ?? data.HardBlocked),
    activeWindow: normalizeWindow(data.activeWindow ?? data.ActiveWindow),
    currentWeekWindow: normalizeWindow(data.currentWeekWindow ?? data.CurrentWeekWindow),
    message: data.message ?? data.Message ?? '',
  }
}

/** Ca quầy đã duyệt đang trong giờ ca (đúng khung giờ template). Null nếu chưa đủ điều kiện. */
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
