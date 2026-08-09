import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { hasPermission } from '../../auth/utils/permissions.js'
import {
  assignmentStatusLabel,
  findSlot,
  formatWeekRange,
  formatWorkDate,
  getTemplate,
  getWeekDays,
  shortName,
} from '../data/mockShiftData.js'
import {
  approveShiftRegistration,
  assignShiftSlot,
  closeShiftRegistrationWindow,
  fetchAssignableShiftStaff,
  fetchShiftRegistrationWindow,
  fetchShiftWeek,
  isSaleShiftSeatTaken,
  isShiftStaffingFull,
  rejectShiftRegistration,
  reopenShiftRegistrationWindow,
  unassignShiftRegistration,
  updateShiftTemplateHours,
  upsertShiftRegistrationWindow,
} from '../services/shiftsApi.js'

function statusTone(status) {
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-900'
  if (status === 'Pending') return 'bg-amber-100 text-amber-900'
  if (status === 'Rejected') return 'bg-rose-100 text-rose-900'
  return 'bg-slate-100 text-slate-600'
}

function toDatetimeLocalValue(isoOrEmpty) {
  if (!isoOrEmpty) return ''
  const d = new Date(isoOrEmpty)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(localValue) {
  if (!localValue) return ''
  const d = new Date(localValue)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function defaultWindowLocals() {
  const open = new Date()
  const close = new Date(open.getTime() + 24 * 60 * 60 * 1000)
  return {
    opensAtLocal: toDatetimeLocalValue(open.toISOString()),
    closesAtLocal: toDatetimeLocalValue(close.toISOString()),
  }
}

function windowStatusLabel(status) {
  if (status === 'Open') return 'Đang mở'
  if (status === 'Scheduled') return 'Đã lên lịch'
  if (status === 'Expired') return 'Hết hạn'
  if (status === 'Closed') return 'Đã đóng'
  return status || '—'
}

/** Chuẩn hoá HH:mm cho input type=time / so sánh dirty. */
function normalizeTimeHm(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return s
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

function ShiftManagePage() {
  const auth = loadAuthSession()
  const canManage = hasPermission(auth, 'MANAGE_EMPLOYEE') || hasPermission(auth, 'MANAGE_ROLE')
  const canReview = canManage
  const [weekOffset, setWeekOffset] = useState(0)
  const [areaFilter] = useState('Shelf')
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [templates, setTemplates] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [staffOptions, setStaffOptions] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassigningId, setUnassigningId] = useState('')
  const [regWindow, setRegWindow] = useState(null)
  const [opensAtLocal, setOpensAtLocal] = useState(() => defaultWindowLocals().opensAtLocal)
  const [closesAtLocal, setClosesAtLocal] = useState(() => defaultWindowLocals().closesAtLocal)
  const [savingWindow, setSavingWindow] = useState(false)
  /** Draft giờ khung ca: { [templateId]: { start, end } } */
  const [hoursDraft, setHoursDraft] = useState({})
  const [savingTemplateId, setSavingTemplateId] = useState('')

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const weekStart = weekDays[0]?.iso

  const loadWeek = async (offset = weekOffset, area = areaFilter) => {
    const days = getWeekDays(offset)
    const start = days[0]?.iso
    if (!start) return
    setLoading(true)
    try {
      const data = await fetchShiftWeek({ weekStart: start, area: area || undefined })
      setTemplates(data.templates)
      setSlots(data.slots)
      setHoursDraft(
        Object.fromEntries(
          (data.templates || []).map((t) => [
            t.id,
            { start: normalizeTimeHm(t.start), end: normalizeTimeHm(t.end) },
          ]),
        ),
      )
    } catch (error) {
      showError(error.message || 'Không tải được lịch ca.')
      setTemplates([])
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  const loadRegWindow = async (start = weekStart) => {
    if (!canManage || !start) return
    try {
      const data = await fetchShiftRegistrationWindow(start)
      setRegWindow(data)
      if (data) {
        setOpensAtLocal(toDatetimeLocalValue(data.opensAt))
        setClosesAtLocal(toDatetimeLocalValue(data.closesAt))
      } else {
        const defaults = defaultWindowLocals()
        setOpensAtLocal(defaults.opensAtLocal)
        setClosesAtLocal(defaults.closesAtLocal)
      }
    } catch {
      setRegWindow(null)
    }
  }

  useEffect(() => {
    loadWeek(weekOffset, areaFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, areaFilter])

  useEffect(() => {
    loadRegWindow(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, canManage])

  useEffect(() => {
    if (!canManage) return
    fetchAssignableShiftStaff()
      .then(setStaffOptions)
      .catch(() => setStaffOptions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadWeek = (nextOffset) => {
    setWeekOffset(nextOffset)
    setSelectedSlotId(null)
  }

  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => !areaFilter || t.area === areaFilter)
  }, [templates, areaFilter])

  const selected = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId],
  )
  const selectedTpl = selected ? getTemplate(templates, selected.templateId) : null

  useEffect(() => {
    setSelectedStaffId('')
  }, [selectedSlotId])

  const assignableStaffOptions = useMemo(() => {
    if (!selected) return []
    const onSlotIds = new Set(
      selected.assignments
        .filter((a) => a.status === 'Approved' || a.status === 'Pending')
        .map((a) => a.staffId),
    )
    return staffOptions.filter(
      (s) =>
        !onSlotIds.has(s.userId)
        && !isSaleShiftSeatTaken(selected.assignments, s.roleName, { includePending: true }),
    )
  }, [selected, staffOptions])

  const canAssignSelected = useMemo(() => {
    if (!selected || !selectedTpl || !canManage) return false
    if (selected.status === 'Closed') return false
    return !isShiftStaffingFull(selected.assignments, selectedTpl.capacity)
  }, [selected, selectedTpl, canManage])

  const stats = useMemo(() => {
    const relevant = slots.filter((s) => {
      const tpl = getTemplate(templates, s.templateId)
      return !areaFilter || tpl?.area === areaFilter
    })
    const pending = relevant.reduce(
      (n, s) => n + s.assignments.filter((a) => a.status === 'Pending').length,
      0,
    )
    const approved = relevant.reduce(
      (n, s) => n + s.assignments.filter((a) => a.status === 'Approved').length,
      0,
    )
    const empty = relevant.filter(
      (s) => s.status === 'Open' && s.assignments.filter((a) => a.status === 'Approved').length === 0,
    ).length
    return [
      { id: 'empty', label: 'Ô ca trống', value: String(empty), note: 'Chưa có người duyệt' },
      { id: 'pending', label: 'Chờ duyệt', value: String(pending), warn: pending > 0, note: 'Cần Manager xử lý' },
      { id: 'approved', label: 'Đã xếp', value: String(approved), note: 'Đăng ký đã duyệt' },
    ]
  }, [slots, templates, areaFilter])

  const reviewAssignment = async (registrationId, action) => {
    try {
      if (action === 'Approved') await approveShiftRegistration(registrationId)
      else await rejectShiftRegistration(registrationId)
      showSuccess(action === 'Approved' ? 'Đã duyệt đăng ký ca.' : 'Đã từ chối đăng ký.')
      await loadWeek(weekOffset, areaFilter)
    } catch (error) {
      showError(error.message || 'Không cập nhật được đăng ký.')
    }
  }

  const assignSlot = async () => {
    if (!selected || !selectedStaffId) return
    setAssigning(true)
    try {
      await assignShiftSlot(selected.id, selectedStaffId)
      showSuccess('Đã chỉ định nhân viên vào ca.')
      setSelectedStaffId('')
      await loadWeek(weekOffset, areaFilter)
    } catch (error) {
      showError(error.message || 'Không chỉ định được ca.')
    } finally {
      setAssigning(false)
    }
  }

  const unassignStaff = async (registrationId, staffName) => {
    if (!registrationId) return
    if (!(await confirmDialog({
      title: 'Xác nhận',
      message: `Gỡ «${staffName || 'nhân viên'}» khỏi ca này?`,
      tone: 'danger',
    }))) return
    setUnassigningId(registrationId)
    try {
      await unassignShiftRegistration(registrationId)
      showSuccess('Đã gỡ nhân viên khỏi ca.')
      await loadWeek(weekOffset, areaFilter)
    } catch (error) {
      showError(error.message || 'Không gỡ được nhân viên khỏi ca.')
    } finally {
      setUnassigningId('')
    }
  }

  const saveRegistrationWindow = async () => {
    if (!weekStart) return
    const opensAt = fromDatetimeLocalValue(opensAtLocal)
    const closesAt = fromDatetimeLocalValue(closesAtLocal)
    if (!opensAt || !closesAt) {
      showError('Vui lòng chọn đủ thời điểm mở và hạn đóng đăng ký.')
      return
    }
    setSavingWindow(true)
    try {
      const data = await upsertShiftRegistrationWindow({ weekStart, opensAt, closesAt })
      setRegWindow(data)
      showSuccess(data?.isOpenNow ? 'Đã mở cửa sổ đăng ký ca.' : 'Đã lưu lịch mở đăng ký ca.')
    } catch (error) {
      showError(error.message || 'Không lưu được cửa sổ đăng ký.')
    } finally {
      setSavingWindow(false)
    }
  }

  const closeWindow = async () => {
    if (!regWindow?.id) return
    setSavingWindow(true)
    try {
      const data = await closeShiftRegistrationWindow(regWindow.id)
      setRegWindow(data)
      showSuccess('Đã đóng đăng ký ca cho tuần này.')
    } catch (error) {
      showError(error.message || 'Không đóng được cửa sổ đăng ký.')
    } finally {
      setSavingWindow(false)
    }
  }

  const reopenWindow = async () => {
    if (!regWindow?.id) return
    setSavingWindow(true)
    try {
      const data = await reopenShiftRegistrationWindow(regWindow.id)
      setRegWindow(data)
      showSuccess('Đã mở lại đăng ký ca.')
    } catch (error) {
      showError(error.message || 'Không mở lại được cửa sổ đăng ký.')
    } finally {
      setSavingWindow(false)
    }
  }

  const setTemplateHourField = (templateId, field, value) => {
    setHoursDraft((prev) => ({
      ...prev,
      [templateId]: {
        start: prev[templateId]?.start ?? '',
        end: prev[templateId]?.end ?? '',
        [field]: value,
      },
    }))
  }

  const saveTemplateHours = async (template) => {
    if (!template?.id) return
    const draft = hoursDraft[template.id] || { start: template.start, end: template.end }
    const start = String(draft.start || '').trim()
    const end = String(draft.end || '').trim()
    if (!start || !end) {
      showError('Vui lòng nhập đủ giờ bắt đầu và kết thúc.')
      return
    }
    setSavingTemplateId(template.id)
    try {
      const updated = await updateShiftTemplateHours(template.id, { start, end })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
      setHoursDraft((prev) => ({
        ...prev,
        [updated.id]: { start: updated.start, end: updated.end },
      }))
      showSuccess(`Đã cập nhật giờ «${updated.name}»: ${updated.start}–${updated.end}.`)
    } catch (error) {
      showError(error.message || 'Không lưu được giờ ca.')
    } finally {
      setSavingTemplateId('')
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif] gap-3 sm:gap-3">
      <PageHeader
        compact
        title="Phân ca làm"
        titleInfo="Manager chỉnh giờ khung ca, mở/đóng đăng ký theo tuần, chỉ định / gỡ Sale. Sale chỉ tự đăng ký khi cửa sổ đang mở."
      />

      {canManage ? (
        <div className="rounded-xl border border-[#356647]/20 bg-[#356647]/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#356647]">
              Cửa sổ đăng ký · tuần {formatWeekRange(weekDays)}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                regWindow?.isOpenNow
                  ? 'bg-emerald-100 text-emerald-800'
                  : regWindow?.status === 'Closed' || regWindow?.status === 'Expired'
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-amber-100 text-amber-900'
              }`}
            >
              {regWindow ? windowStatusLabel(regWindow.status) : 'Chưa mở'}
            </span>
            {regWindow?.isOpenNow ? (
              <span className="text-xs text-slate-600">Sale đang đăng ký được</span>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-end gap-3">
            <label className="block w-[min(100%,14rem)] text-slate-700">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Mở lúc</span>
              <input
                type="datetime-local"
                value={opensAtLocal}
                onChange={(e) => setOpensAtLocal(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/15"
              />
            </label>
            <label className="block w-[min(100%,14rem)] text-slate-700">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Hạn đóng</span>
              <input
                type="datetime-local"
                value={closesAtLocal}
                onChange={(e) => setClosesAtLocal(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/15"
              />
            </label>
            <div className="flex flex-wrap gap-2 pb-0.5">
              <button
                type="button"
                disabled={savingWindow}
                onClick={saveRegistrationWindow}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2d553b] disabled:opacity-60"
              >
                {savingWindow ? 'Đang lưu…' : regWindow ? 'Cập nhật thời hạn' : 'Mở đăng ký ca'}
              </button>
              {regWindow?.id && regWindow.status === 'Open' ? (
                <button
                  type="button"
                  disabled={savingWindow}
                  onClick={closeWindow}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Đóng ngay
                </button>
              ) : null}
              {regWindow?.id && regWindow.isManuallyClosed ? (
                <button
                  type="button"
                  disabled={savingWindow}
                  onClick={reopenWindow}
                  className="rounded-xl border border-[#356647]/40 bg-white px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-60"
                >
                  Mở lại
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => reloadWeek(weekOffset - 1)}
            className="rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Tuần trước"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <div className="min-w-[8.5rem] px-1 text-center text-sm font-bold text-slate-900">
            {formatWeekRange(weekDays)}
          </div>
          <button
            type="button"
            onClick={() => reloadWeek(weekOffset + 1)}
            className="rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Tuần sau"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => reloadWeek(0)}
              className="mr-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#356647] hover:bg-slate-50"
            >
              Tuần này
            </button>
          ) : null}
        </div>

        {!loading ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-1.5">
            {stats.map((item) => (
              <div
                key={item.id}
                className={`flex min-w-[6.5rem] flex-1 items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 shadow-sm ${
                  item.warn ? 'border-rose-200' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className={`text-base font-bold tabular-nums leading-tight ${item.warn ? 'text-rose-700' : 'text-slate-900'}`}>
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải lịch ca…
        </p>
      ) : (
        <div className={`grid gap-3 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
          <div className="min-w-0 space-y-2">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[720px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-10 w-36 min-w-[9rem] border-b border-r border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Khung ca
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.iso}
                        className={`border-b border-slate-200 px-1 py-2 text-center ${
                          day.isToday ? 'bg-[#356647]/10' : ''
                        }`}
                      >
                        <div className={`text-[10px] font-bold uppercase ${day.isToday ? 'text-[#356647]' : 'text-slate-500'}`}>
                          {day.label}
                        </div>
                        <div className={`text-sm font-bold ${day.isToday ? 'text-[#356647]' : 'text-slate-800'}`}>
                          {day.dayNum}/{day.monthNum}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                        Chưa có khung ca{weekStart ? ` cho tuần ${weekStart}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    visibleTemplates.map((tpl) => {
                      const draft = hoursDraft[tpl.id] || {
                        start: normalizeTimeHm(tpl.start),
                        end: normalizeTimeHm(tpl.end),
                      }
                      const currentStart = normalizeTimeHm(tpl.start)
                      const currentEnd = normalizeTimeHm(tpl.end)
                      const dirty =
                        normalizeTimeHm(draft.start) !== currentStart
                        || normalizeTimeHm(draft.end) !== currentEnd
                      const savingHours = savingTemplateId === tpl.id

                      return (
                        <tr key={tpl.id} className="align-top">
                          <th className="sticky left-0 z-10 w-36 min-w-[9rem] border-b border-r border-slate-200 bg-white px-2.5 py-2 text-left">
                            <div className="flex items-start gap-1.5">
                              <span
                                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ background: tpl.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold leading-tight text-slate-900">{tpl.name}</p>
                                {canManage ? (
                                  <div
                                    className="mt-1 space-y-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-0.5">
                                      <input
                                        type="time"
                                        step="60"
                                        value={normalizeTimeHm(draft.start) || ''}
                                        onChange={(e) => setTemplateHourField(tpl.id, 'start', e.target.value)}
                                        className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-0.5 py-0.5 text-[10px] font-semibold text-slate-800"
                                        title="Giờ bắt đầu"
                                        aria-label={`${tpl.name} bắt đầu`}
                                      />
                                      <span className="shrink-0 text-[10px] text-slate-400">–</span>
                                      <input
                                        type="time"
                                        step="60"
                                        value={normalizeTimeHm(draft.end) || ''}
                                        onChange={(e) => setTemplateHourField(tpl.id, 'end', e.target.value)}
                                        className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-0.5 py-0.5 text-[10px] font-semibold text-slate-800"
                                        title="Giờ kết thúc"
                                        aria-label={`${tpl.name} kết thúc`}
                                      />
                                    </div>
                                    {dirty || savingHours ? (
                                      <button
                                        type="button"
                                        disabled={savingHours || !dirty}
                                        onClick={() => saveTemplateHours(tpl)}
                                        className="w-full rounded bg-[#356647] px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-[#2d553b] disabled:opacity-40"
                                      >
                                        {savingHours ? 'Đang lưu…' : 'Lưu giờ'}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                                    {currentStart}–{currentEnd}
                                  </p>
                                )}
                              </div>
                            </div>
                          </th>
                          {weekDays.map((day) => {
                            const slot = findSlot(slots, day.iso, tpl.id)
                            const approved = slot?.assignments.filter((a) => a.status === 'Approved') || []
                            const pending = slot?.assignments.filter((a) => a.status === 'Pending') || []
                            const isSelected = selectedSlotId === slot?.id
                            const isClosed = slot?.status === 'Closed'
                            const isFull = isShiftStaffingFull(slot?.assignments || [], tpl.capacity)
                            const isEmpty = approved.length === 0 && pending.length === 0

                            return (
                              <td
                                key={`${day.iso}-${tpl.id}`}
                                className={`border-b border-slate-200 p-0.5 ${day.isToday ? 'bg-[#356647]/[0.03]' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => slot && setSelectedSlotId(slot.id)}
                                  className={`flex min-h-[68px] w-full flex-col rounded-md border px-1.5 py-1 text-left transition ${
                                    isSelected
                                      ? 'border-[#356647] bg-[#356647]/10 ring-1 ring-[#356647]/40'
                                      : isClosed
                                        ? 'border-slate-200 bg-slate-50 opacity-80'
                                        : isEmpty
                                          ? 'border-dashed border-slate-300 bg-white hover:border-[#356647]/50'
                                          : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  {isClosed ? (
                                    <span className="text-[9px] font-bold uppercase text-slate-400">Khóa</span>
                                  ) : isEmpty ? (
                                    <span className="text-[10px] font-semibold text-slate-400">Trống</span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase text-slate-400">
                                      {approved.length}/{tpl.capacity}
                                      {pending.length ? ` · +${pending.length}` : ''}
                                    </span>
                                  )}
                                  <div className="mt-0.5 flex flex-col gap-0.5">
                                    {(slot?.assignments || []).slice(0, 3).map((a) => (
                                      <span
                                        key={a.id || `${slot.id}-${a.staffId}`}
                                        className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold ${statusTone(a.status)}`}
                                        title={`${a.name} · ${assignmentStatusLabel(a.status)}`}
                                      >
                                        {shortName(a.name)}
                                      </span>
                                    ))}
                                  </div>
                                  {!isClosed && isFull && pending.length === 0 ? (
                                    <span className="mt-auto text-[9px] font-semibold text-emerald-700">Đủ</span>
                                  ) : null}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">Chú thích</span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-900">A.</span>
                Duyệt
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">B.</span>
                Chờ
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded border border-dashed border-slate-300 px-1 text-[10px] text-slate-400">···</span>
                Trống
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded border border-slate-200 bg-slate-50 px-1 text-[9px] font-bold uppercase text-slate-400">khóa</span>
                Khóa
              </span>
              <span className="text-slate-500">1 POS + 1 COD / ca</span>
              {!selected ? (
                <span className="ml-auto text-slate-400">Chọn ô trên lịch để xem chi tiết</span>
              ) : null}
            </div>
          </div>

          {selected ? (
          <aside className="xl:sticky xl:top-3 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Chi tiết ô ca</p>
                <button
                  type="button"
                  onClick={() => setSelectedSlotId(null)}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Đóng chi tiết"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900">{selectedTpl?.name}</h3>
                  <p className="text-sm text-slate-600">
                    {formatWorkDate(selected.workDate)} · {selectedTpl?.start}–{selectedTpl?.end}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#356647]">{selectedTpl?.areaLabel}</p>

                  <ul className="mt-3 space-y-2">
                    {selected.assignments.length === 0 ? (
                      <li className="text-sm text-slate-500">Chưa có đăng ký.</li>
                    ) : (
                      selected.assignments.map((a) => (
                        <li key={a.id || a.staffId} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">{a.name}</p>
                              <p className="text-xs text-slate-500">{a.role}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(a.status)}`}>
                              {assignmentStatusLabel(a.status)}
                            </span>
                          </div>
                          {canReview && a.status === 'Pending' && selected.status !== 'Closed' ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => reviewAssignment(a.id, 'Approved')}
                                className="rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d553b]"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewAssignment(a.id, 'Rejected')}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : null}
                          {canManage
                          && selected.status !== 'Closed'
                          && (a.status === 'Approved' || a.status === 'Pending') ? (
                            <button
                              type="button"
                              disabled={unassigningId === a.id}
                              onClick={() => unassignStaff(a.id, a.name)}
                              className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              {unassigningId === a.id ? 'Đang gỡ…' : 'Gỡ khỏi ca'}
                            </button>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>

                  {canManage && canAssignSelected ? (
                    <div className="mt-3 rounded-xl border border-[#356647]/25 bg-[#356647]/[0.04] px-3 py-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Chỉ định nhân viên</p>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"
                      >
                        <option value="">Chọn nhân viên Sale…</option>
                        {assignableStaffOptions.map((s) => (
                          <option key={s.userId} value={s.userId}>
                            {s.fullName} · {s.roleName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedStaffId || assigning}
                        onClick={assignSlot}
                        className="mt-2 w-full rounded-lg bg-[#356647] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2d553b] disabled:opacity-60"
                      >
                        {assigning ? 'Đang chỉ định…' : 'Chỉ định vào ca'}
                      </button>
                      {assignableStaffOptions.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Không còn nhân viên Sale nào khả dụng cho ô ca này.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
            </div>
          </aside>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

export default ShiftManagePage
