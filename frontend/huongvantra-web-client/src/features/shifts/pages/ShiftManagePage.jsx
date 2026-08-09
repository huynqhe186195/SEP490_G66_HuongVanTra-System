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
import ManagerSlotCashFundPanel from '../../pos/components/ManagerSlotCashFundPanel.jsx'

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
  }

  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => !areaFilter || t.area === areaFilter)
  }, [templates, areaFilter])

  const selected = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId],
  )
  const selectedTpl = selected ? getTemplate(templates, selected.templateId) : null

  // Giữ panel chi tiết luôn có ô: ưu tiên hôm nay + khung đầu, không cho đóng/ẩn panel.
  useEffect(() => {
    if (loading || slots.length === 0) return
    if (selectedSlotId && slots.some((s) => s.id === selectedSlotId)) return
    const todayIso = weekDays.find((d) => d.isToday)?.iso
    let next = null
    if (todayIso) {
      for (const tpl of visibleTemplates) {
        const slot = findSlot(slots, todayIso, tpl.id)
        if (slot) {
          next = slot
          break
        }
      }
    }
    if (!next) {
      next = slots.find((s) => visibleTemplates.some((t) => t.id === s.templateId)) || slots[0]
    }
    if (next?.id) setSelectedSlotId(next.id)
  }, [loading, slots, selectedSlotId, weekDays, visibleTemplates])

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
    const startHm = normalizeTimeHm(start)
    const endHm = normalizeTimeHm(end)
    if (startHm >= endHm) {
      showError('Giờ kết thúc phải sau giờ bắt đầu (cùng ngày).')
      return
    }
    // Cùng khu vực: không chồng giờ (chạm đúng mốc vẫn OK).
    const peer = templates.find((t) => {
      if (t.id === template.id) return false
      if (String(t.area || '') !== String(template.area || '')) return false
      const peerStart = normalizeTimeHm(t.start)
      const peerEnd = normalizeTimeHm(t.end)
      return startHm < peerEnd && peerStart < endHm
    })
    if (peer) {
      showError(
        `Giờ trùng với «${peer.name}» (${normalizeTimeHm(peer.start)}–${normalizeTimeHm(peer.end)}). `
        + 'Hai ca cùng khu không được chồng giờ.',
      )
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
        titleInfo="Manager chỉnh giờ khung ca (cùng khu không chồng giờ), mở/đóng quỹ POS theo từng ô ca, mở/đóng đăng ký tuần, chỉ định / gỡ Sale."
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

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-0.5 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => reloadWeek(weekOffset - 1)}
            className="rounded-xl px-2 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Tuần trước"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <div className="min-w-[9rem] px-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tuần</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">{formatWeekRange(weekDays)}</p>
          </div>
          <button
            type="button"
            onClick={() => reloadWeek(weekOffset + 1)}
            className="rounded-xl px-2 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Tuần sau"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => reloadWeek(0)}
              className="mr-0.5 rounded-xl bg-[#356647]/10 px-2.5 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/15"
            >
              Tuần này
            </button>
          ) : null}
        </div>

        {!loading ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-2">
            {stats.map((item) => (
              <div
                key={item.id}
                className={`flex min-w-[5.75rem] flex-1 items-center justify-between gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm ${
                  item.warn ? 'border-rose-200/80 bg-rose-50/40' : 'border-slate-200/90'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className={`text-lg font-bold tabular-nums leading-none ${item.warn ? 'text-rose-700' : 'text-slate-900'}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Đang tải lịch ca…
        </p>
      ) : (
        <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_292px]">
          <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-x-auto">
              <table className="h-full min-w-[780px] w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <colgroup>
                  <col style={{ width: '10.75rem' }} />
                  {weekDays.map((day) => (
                    <col key={`col-${day.iso}`} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-[#f7f6f1]">
                    <th className="sticky left-0 z-20 w-[10.75rem] max-w-[10.75rem] overflow-hidden border-b border-r border-slate-200/80 bg-[#f7f6f1] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Khung ca
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.iso}
                        className={`border-b border-slate-200/80 px-1 py-2.5 text-center ${
                          day.isToday ? 'bg-[#356647]/[0.08]' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${day.isToday ? 'text-[#356647]' : 'text-slate-400'}`}>
                            {day.label}
                          </span>
                          <span
                            className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-1.5 py-0.5 text-sm font-bold tabular-nums ${
                              day.isToday
                                ? 'bg-[#356647] text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            {day.dayNum}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={weekDays.length + 1}
                        className="px-4 py-12 text-center text-sm text-slate-500"
                      >
                        Không có khung ca phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    visibleTemplates.map((tpl, rowIdx) => {
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
                      const isLastRow = rowIdx === visibleTemplates.length - 1
                      const rowHeightPct = `${(100 / visibleTemplates.length).toFixed(4)}%`

                      return (
                        <tr key={tpl.id} style={{ height: rowHeightPct }}>
                          <th
                            className={`sticky left-0 z-20 w-[10.75rem] max-w-[10.75rem] overflow-hidden border-r border-slate-200/80 bg-white px-2 py-2 text-left align-middle ${
                              isLastRow ? '' : 'border-b'
                            }`}
                          >
                            <div className="flex min-w-0 gap-1.5">
                              <span
                                className={`mt-1 h-8 w-1 shrink-0 rounded-full ${
                                  tpl.area === 'Warehouse' ? 'bg-sky-500' : 'bg-[#356647]'
                                }`}
                              />
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="truncate text-xs font-bold leading-snug text-slate-900">{tpl.name}</p>
                                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                                  {tpl.areaLabel}
                                </p>
                                {canManage ? (
                                  <div className="mt-1.5 space-y-1">
                                    <label className="block space-y-0.5">
                                      <span className="text-[9px] font-semibold text-slate-500">Bắt đầu</span>
                                      <input
                                        type="time"
                                        value={draft.start}
                                        onChange={(e) =>
                                          setHoursDraft((prev) => ({
                                            ...prev,
                                            [tpl.id]: { ...draft, start: e.target.value },
                                          }))
                                        }
                                        className="w-full min-w-0 rounded-md border border-slate-200 bg-[#fbf9f1]/70 px-1 py-0.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#356647]"
                                        title="Giờ bắt đầu"
                                        aria-label={`${tpl.name} bắt đầu`}
                                      />
                                    </label>
                                    <label className="block space-y-0.5">
                                      <span className="text-[9px] font-semibold text-slate-500">Kết thúc</span>
                                      <input
                                        type="time"
                                        value={draft.end}
                                        onChange={(e) =>
                                          setHoursDraft((prev) => ({
                                            ...prev,
                                            [tpl.id]: { ...draft, end: e.target.value },
                                          }))
                                        }
                                        className="w-full min-w-0 rounded-md border border-slate-200 bg-[#fbf9f1]/70 px-1 py-0.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#356647]"
                                        title="Giờ kết thúc"
                                        aria-label={`${tpl.name} kết thúc`}
                                      />
                                    </label>
                                    {dirty || savingHours ? (
                                      <button
                                        type="button"
                                        disabled={savingHours || !dirty}
                                        onClick={() => saveTemplateHours(tpl)}
                                        className="w-full rounded-md bg-[#356647] px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-[#2d553b] disabled:opacity-40"
                                      >
                                        {savingHours ? 'Đang lưu…' : 'Lưu giờ'}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[11px] font-bold tabular-nums text-slate-600">
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
                                className={`p-1 align-middle ${isLastRow ? '' : 'border-b border-slate-100'} ${
                                  day.isToday ? 'bg-[#356647]/[0.03]' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => slot && setSelectedSlotId(slot.id)}
                                  className={`group flex h-full min-h-[72px] w-full flex-col rounded-xl border px-1.5 py-1.5 text-left transition ${
                                    isSelected
                                      ? 'border-[#356647] bg-[#356647]/[0.09] shadow-sm ring-1 ring-[#356647]/30'
                                      : isClosed
                                        ? 'border-slate-200/80 bg-slate-50/80 opacity-75'
                                        : isEmpty
                                          ? 'border-dashed border-slate-300/90 bg-[#fbf9f1]/40 hover:border-[#356647]/45 hover:bg-[#356647]/[0.03]'
                                          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                                  }`}
                                >
                                  {isClosed ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Khóa</span>
                                  ) : isEmpty ? (
                                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-[#356647]/80">Trống</span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                      {approved.length}/{tpl.capacity}
                                      {pending.length ? ` · +${pending.length}` : ''}
                                    </span>
                                  )}
                                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                    {(slot?.assignments || []).slice(0, 3).map((a) => (
                                      <span
                                        key={a.id || `${slot.id}-${a.staffId}`}
                                        className={`truncate rounded-md px-1 py-0.5 text-[10px] font-semibold ${statusTone(a.status)}`}
                                        title={`${a.name} · ${assignmentStatusLabel(a.status)}`}
                                      >
                                        {shortName(a.name)}
                                      </span>
                                    ))}
                                  </div>
                                  {!isClosed && isFull && pending.length === 0 ? (
                                    <span className="mt-auto pt-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                      Đủ
                                    </span>
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

            <footer className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-200/80 bg-[#f7f6f1]/80 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-bold text-slate-700">Chú thích</span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">Duyệt</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Chờ</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded-md border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-400">Trống</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">Khóa</span>
              </span>
              <span className="hidden text-slate-400 sm:inline">·</span>
              <span className="text-slate-500">1 POS + 1 COD / ca</span>
              <span className="ml-auto text-[10px] text-slate-400">Chọn ô để xem chi tiết</span>
            </footer>
          </section>

          <aside className="flex h-full min-h-[14rem] flex-col xl:min-h-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-[#f7f6f1]/80 px-3.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#538463]">Chi tiết ca</p>
                {selected && selectedTpl ? (
                  <div className="mt-1">
                    <h3 className="text-[15px] font-bold leading-snug text-slate-900">{selectedTpl.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatWorkDate(selected.workDate)}
                      {' · '}
                      <span className="font-semibold tabular-nums text-slate-600">
                        {selectedTpl.start}–{selectedTpl.end}
                      </span>
                      {selectedTpl.areaLabel ? ` · ${selectedTpl.areaLabel}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">Đang tải…</p>
                )}
              </div>

              {selected && selectedTpl ? (
                <div className="flex min-h-0 flex-1 flex-col px-3.5 py-3">
                  {canManage ? (
                    <ManagerSlotCashFundPanel
                      enabled={canManage}
                      slot={selected}
                      template={selectedTpl}
                      compact
                    />
                  ) : null}

                  <div className={`min-h-0 flex-1 ${canManage ? 'mt-3 border-t border-slate-100 pt-2.5' : ''}`}>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Nhân sự
                      {' '}
                      ({selected.assignments.length})
                    </p>
                    {selected.assignments.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-[#fbf9f1]/50 px-3 py-4 text-center text-xs text-slate-500">
                        Chưa có đăng ký.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {selected.assignments.map((a) => (
                          <li
                            key={a.id || a.staffId}
                            className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-2.5 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{a.name}</p>
                                <p className="truncate text-[11px] text-slate-500">{a.role}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(a.status)}`}>
                                {assignmentStatusLabel(a.status)}
                              </span>
                            </div>
                            {canReview && a.status === 'Pending' && selected.status !== 'Closed' ? (
                              <div className="mt-1.5 flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => reviewAssignment(a.id, 'Approved')}
                                  className="rounded-lg bg-[#356647] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#2d553b]"
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reviewAssignment(a.id, 'Rejected')}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
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
                                className="mt-1.5 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                {unassigningId === a.id ? 'Đang gỡ…' : 'Gỡ khỏi ca'}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canManage && canAssignSelected ? (
                    <div className="mt-auto space-y-1.5 border-t border-slate-100 pt-2.5">
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[#356647]"
                        aria-label="Chỉ định nhân viên"
                      >
                        <option value="">Chỉ định Sale…</option>
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
                        className="w-full rounded-xl bg-[#356647] px-2.5 py-2 text-xs font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
                      >
                        {assigning ? 'Đang chỉ định…' : 'Chỉ định'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  )
}

export default ShiftManagePage
