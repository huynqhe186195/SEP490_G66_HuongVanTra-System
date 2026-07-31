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
    return staffOptions.filter((s) => !onSlotIds.has(s.userId))
  }, [selected, staffOptions])

  const canAssignSelected = useMemo(() => {
    if (!selected || !selectedTpl || !canManage) return false
    if (selected.status === 'Closed') return false
    const approvedCount = selected.assignments.filter((a) => a.status === 'Approved').length
    return approvedCount < selectedTpl.capacity
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
      { label: 'Ô ca trống', value: String(empty), icon: 'event_busy' },
      { label: 'Chờ duyệt', value: String(pending), icon: 'hourglass_top' },
      { label: 'Đã xếp', value: String(approved), icon: 'group' },
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
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Phân ca làm"
        titleInfo="Manager chỉnh giờ khung ca, mở/đóng đăng ký theo tuần, chỉ định / gỡ Sale. Sale chỉ tự đăng ký khi cửa sổ đang mở."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[#414942]">
          <span>Nhân sự</span>
          <span>/</span>
          <span className="font-semibold text-[#356647]">Phân ca</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#356647] sm:text-3xl">Lịch ca theo tuần</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#414942]">
              Mở cửa sổ đăng ký cho tuần đang xem, rồi chỉ định / duyệt Sale trên lưới bên dưới.
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="mt-5 rounded-2xl border border-[#356647]/25 bg-[#356647]/5 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#356647]">
                  Cửa sổ đăng ký · tuần {formatWeekRange(weekDays)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Trạng thái:{' '}
                  <strong>
                    {regWindow ? windowStatusLabel(regWindow.status) : 'Chưa mở'}
                  </strong>
                  {regWindow?.isOpenNow ? ' — Sale đang đăng ký được' : null}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Mở lúc</span>
                <input
                  type="datetime-local"
                  value={opensAtLocal}
                  onChange={(e) => setOpensAtLocal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Hạn đóng</span>
                <input
                  type="datetime-local"
                  value={closesAtLocal}
                  onChange={(e) => setClosesAtLocal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Đóng ngay
                </button>
              ) : null}
              {regWindow?.id && regWindow.isManuallyClosed ? (
                <button
                  type="button"
                  disabled={savingWindow}
                  onClick={reopenWindow}
                  className="rounded-xl border border-[#356647]/40 px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-white disabled:opacity-60"
                >
                  Mở lại
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-[#fbf9f1] p-1">
            <button
              type="button"
              onClick={() => reloadWeek(weekOffset - 1)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
              aria-label="Tuần trước"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <div className="min-w-[9rem] px-2 text-center text-sm font-bold text-slate-900">
              {formatWeekRange(weekDays)}
            </div>
            <button
              type="button"
              onClick={() => reloadWeek(weekOffset + 1)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
              aria-label="Tuần sau"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => reloadWeek(0)}
                className="ml-1 rounded-lg px-3 py-2 text-xs font-semibold text-[#356647] hover:bg-white"
              >
                Tuần này
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Đang tải lịch ca…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border border-[#e7e8e0] bg-[#fbf9f1] px-4 py-3"
                >
                  <span className="material-symbols-outlined rounded-xl bg-[#356647]/15 p-2 text-[#356647]">
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="text-xl font-bold text-slate-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="overflow-x-auto rounded-2xl border border-[#e7e8e0]">
                <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#f6f4ec]">
                      <th className="sticky left-0 z-10 w-64 min-w-[16rem] border-b border-r border-[#e7e8e0] bg-[#f6f4ec] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Khung ca
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={day.iso}
                          className={`border-b border-[#e7e8e0] px-2 py-3 text-center ${
                            day.isToday ? 'bg-[#356647]/10' : ''
                          }`}
                        >
                          <div className={`text-xs font-bold uppercase ${day.isToday ? 'text-[#356647]' : 'text-slate-500'}`}>
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
                          <th className="sticky left-0 z-10 w-64 min-w-[16rem] border-b border-r border-[#e7e8e0] bg-white px-3 py-3 text-left">
                            <div className="flex items-start gap-2">
                              <span
                                className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: tpl.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900">{tpl.name}</p>
                                <p className="text-[11px] text-slate-500">max {tpl.capacity} người</p>
                                {canManage ? (
                                  <div
                                    className="mt-2 space-y-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="time"
                                        step="60"
                                        value={normalizeTimeHm(draft.start) || ''}
                                        onChange={(e) => setTemplateHourField(tpl.id, 'start', e.target.value)}
                                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-[#fbf9f1] px-1.5 py-1.5 text-xs font-semibold text-slate-800"
                                        title="Giờ bắt đầu"
                                        aria-label={`${tpl.name} bắt đầu`}
                                      />
                                      <span className="shrink-0 text-xs text-slate-400">–</span>
                                      <input
                                        type="time"
                                        step="60"
                                        value={normalizeTimeHm(draft.end) || ''}
                                        onChange={(e) => setTemplateHourField(tpl.id, 'end', e.target.value)}
                                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-[#fbf9f1] px-1.5 py-1.5 text-xs font-semibold text-slate-800"
                                        title="Giờ kết thúc"
                                        aria-label={`${tpl.name} kết thúc`}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={savingHours || !dirty}
                                      onClick={() => saveTemplateHours(tpl)}
                                      className="w-full rounded-md bg-[#356647] px-2 py-1.5 text-xs font-bold text-white hover:bg-[#2d553b] disabled:opacity-40"
                                    >
                                      {savingHours ? 'Đang lưu…' : dirty ? 'Lưu giờ' : `${currentStart}–${currentEnd}`}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-xs font-semibold text-slate-600">
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
                            const isFull = approved.length >= tpl.capacity
                            const isEmpty = approved.length === 0 && pending.length === 0

                            return (
                              <td
                                key={`${day.iso}-${tpl.id}`}
                                className={`border-b border-[#e7e8e0] p-1.5 ${day.isToday ? 'bg-[#356647]/[0.03]' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => slot && setSelectedSlotId(slot.id)}
                                  className={`flex min-h-[88px] w-full flex-col rounded-xl border px-2 py-2 text-left transition ${
                                    isSelected
                                      ? 'border-[#356647] bg-[#356647]/10 ring-1 ring-[#356647]/40'
                                      : isClosed
                                        ? 'border-slate-200 bg-slate-50 opacity-80'
                                        : isEmpty
                                          ? 'border-dashed border-slate-300 bg-white hover:border-[#356647]/50'
                                          : 'border-[#e7e8e0] bg-white hover:border-[#c1c9c0]'
                                  }`}
                                >
                                  {isClosed ? (
                                    <span className="text-[10px] font-bold uppercase text-slate-400">Đã khóa</span>
                                  ) : isEmpty ? (
                                    <span className="text-[11px] font-semibold text-slate-400">Trống</span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                      {approved.length}/{tpl.capacity}
                                      {pending.length ? ` · +${pending.length} chờ` : ''}
                                    </span>
                                  )}
                                  <div className="mt-1 flex flex-col gap-1">
                                    {(slot?.assignments || []).slice(0, 3).map((a) => (
                                      <span
                                        key={a.id || `${slot.id}-${a.staffId}`}
                                        className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${statusTone(a.status)}`}
                                        title={`${a.name} · ${assignmentStatusLabel(a.status)}`}
                                      >
                                        {shortName(a.name)}
                                      </span>
                                    ))}
                                  </div>
                                  {!isClosed && isFull && pending.length === 0 ? (
                                    <span className="mt-auto pt-1 text-[10px] font-semibold text-emerald-700">Đủ người</span>
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

              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#e7e8e0] bg-[#fbf9f1] p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Chi tiết ô ca</p>
                  {!selected ? (
                    <p className="mt-3 text-sm text-slate-500">Chọn một ô trên lịch để duyệt / xem người trong ca.</p>
                  ) : (
                    <>
                      <h3 className="mt-2 text-lg font-bold text-slate-900">{selectedTpl?.name}</h3>
                      <p className="text-sm text-slate-600">
                        {formatWorkDate(selected.workDate)} · {selectedTpl?.start}–{selectedTpl?.end}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#356647]">{selectedTpl?.areaLabel}</p>

                      <ul className="mt-4 space-y-2">
                        {selected.assignments.length === 0 ? (
                          <li className="text-sm text-slate-500">Chưa có đăng ký.</li>
                        ) : (
                          selected.assignments.map((a) => (
                            <li key={a.id || a.staffId} className="rounded-xl border border-[#e7e8e0] bg-white px-3 py-3">
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
                                <div className="mt-3 flex gap-2">
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
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
                                  className="mt-3 w-full rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                >
                                  {unassigningId === a.id ? 'Đang gỡ…' : 'Gỡ khỏi ca'}
                                </button>
                              ) : null}
                            </li>
                          ))
                        )}
                      </ul>

                      {canManage && canAssignSelected ? (
                        <div className="mt-4 rounded-xl border border-[#356647]/30 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Chỉ định nhân viên</p>
                          <select
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800"
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
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-dashed border-[#c1c9c0] px-4 py-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Chú thích:</span> xanh = đã duyệt · vàng = chờ duyệt ·
                  ô nét đứt = trống · ô xám = đã khóa
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </PageShell>
  )
}

export default ShiftManagePage
