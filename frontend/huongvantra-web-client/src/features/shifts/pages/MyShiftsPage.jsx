import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { hasPermission, isWarehouseRole } from '../../auth/utils/permissions.js'
import {
  assignmentStatusLabel,
  findSlot,
  formatWeekRange,
  formatWorkDate,
  getTemplate,
  getWeekDays,
  shortName,
} from '../data/mockShiftData.js'
import { fetchShiftWeek, registerShiftSlot } from '../services/shiftsApi.js'

function statusTone(status) {
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-900'
  if (status === 'Pending') return 'bg-amber-100 text-amber-900'
  if (status === 'Rejected') return 'bg-rose-100 text-rose-900'
  return 'bg-slate-100 text-slate-600'
}

function isNowWithinShift(tpl) {
  if (!tpl) return false
  const now = new Date()
  const [sh, sm] = tpl.start.split(':').map(Number)
  const [eh, em] = tpl.end.split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return mins >= start - 30 && mins <= end + 30
}

function MyShiftsPage() {
  const auth = loadAuthSession()
  const myUserId = String(auth?.userId || '')
  const myName = auth?.username || 'Bạn'
  const canManage = hasPermission(auth, 'MANAGE_EMPLOYEE') || hasPermission(auth, 'MANAGE_ROLE')
  const areaHint = isWarehouseRole(auth) ? 'Kho' : 'Quầy'

  const [weekOffset, setWeekOffset] = useState(0)
  const [templates, setTemplates] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  const today = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const loadWeek = async (offset = weekOffset) => {
    const days = getWeekDays(offset)
    const start = days[0]?.iso
    if (!start) return
    setLoading(true)
    try {
      const data = await fetchShiftWeek({ weekStart: start })
      setTemplates(data.templates)
      setSlots(data.slots)
    } catch (error) {
      showError(error.message || 'Không tải được lịch ca.')
      setTemplates([])
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWeek(weekOffset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const reloadWeek = (nextOffset) => {
    setWeekOffset(nextOffset)
    setSelectedSlotId(null)
  }

  const selected = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId],
  )
  const selectedTpl = selected ? getTemplate(templates, selected.templateId) : null
  const myOnSelected = selected?.assignments.find((a) => a.staffId === myUserId) || null

  const onDutyNow = useMemo(() => {
    if (!myUserId) return null
    return slots.find((slot) => {
      if (slot.workDate !== today) return false
      const mine = slot.assignments.find(
        (a) => a.staffId === myUserId && a.status === 'Approved',
      )
      if (!mine) return false
      return isNowWithinShift(getTemplate(templates, slot.templateId))
    })
  }, [slots, templates, today, myUserId])

  const onDutyTpl = onDutyNow ? getTemplate(templates, onDutyNow.templateId) : null

  const canRegisterSelected = () => {
    if (!selected || !selectedTpl || !myUserId) return false
    if (selected.status === 'Closed') return false
    if (selected.workDate < today) return false
    if (myOnSelected) return false
    const approved = selected.assignments.filter((a) => a.status === 'Approved').length
    return approved < selectedTpl.capacity
  }

  const register = async (slotId) => {
    setRegistering(true)
    try {
      await registerShiftSlot(slotId)
      showSuccess('Đã gửi đăng ký — chờ Manager duyệt.')
      await loadWeek(weekOffset)
    } catch (error) {
      showError(error.message || 'Không đăng ký được ca.')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Ca của tôi"
        description="Lịch tuần — click ô trống để đăng ký ca."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[#414942]">
          <span>Nhân sự</span>
          <span>/</span>
          <span className="font-semibold text-[#356647]">Ca của tôi</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#356647] sm:text-3xl">Chọn ca trên lịch tuần</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#414942]">
              Đang xem với tư cách <strong>{myName}</strong>
              {!canManage ? (
                <>
                  {' '}
                  — chỉ hiện ca <strong>{areaHint}</strong>
                </>
              ) : null}
              . Click ô trống / còn chỗ → đăng ký.
            </p>
          </div>
          {canManage ? (
            <Link
              to="/shifts"
              className="rounded-xl border border-[#c1c9c0] px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Góc Manager
            </Link>
          ) : null}
        </div>

        <div
          className={`mt-6 rounded-2xl border px-5 py-4 ${
            onDutyNow ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-[#fbf9f1]'
          }`}
        >
          {onDutyNow ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Đang trong ca</p>
                <p className="mt-1 text-lg font-bold text-emerald-950">
                  {onDutyTpl?.name} · {onDutyTpl?.start}–{onDutyTpl?.end}
                </p>
                <p className="text-sm text-emerald-900/80">
                  Có thể kiểm kê {onDutyTpl?.area === 'Shelf' ? 'kệ' : 'kho'}.
                </p>
              </div>
              <Link
                to="/inventory/stocktake"
                className="rounded-xl bg-[#356647] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d553b]"
              >
                Tới kiểm kê
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ngoài giờ ca</p>
              <p className="mt-1 text-sm text-slate-700">
                Chưa có ca đã duyệt đang diễn ra. Đăng ký trên lưới bên dưới rồi chờ Manager duyệt.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-[#fbf9f1] p-1">
            <button
              type="button"
              onClick={() => reloadWeek(weekOffset - 1)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
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
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
            <div className="overflow-x-auto rounded-2xl border border-[#e7e8e0]">
              <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f6f4ec]">
                    <th className="sticky left-0 z-10 w-36 border-b border-r border-[#e7e8e0] bg-[#f6f4ec] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Khung ca
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.iso}
                        className={`border-b border-[#e7e8e0] px-2 py-3 text-center ${
                          day.isToday ? 'bg-[#356647]/10' : ''
                        }`}
                      >
                        <div
                          className={`text-xs font-bold uppercase ${
                            day.isToday ? 'text-[#356647]' : 'text-slate-500'
                          }`}
                        >
                          {day.label}
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            day.isToday ? 'text-[#356647]' : 'text-slate-800'
                          }`}
                        >
                          {day.dayNum}/{day.monthNum}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                        Không có khung ca phù hợp với vai trò của bạn.
                      </td>
                    </tr>
                  ) : (
                    templates.map((tpl) => (
                      <tr key={tpl.id} className="align-top">
                        <th className="sticky left-0 z-10 border-b border-r border-[#e7e8e0] bg-white px-3 py-3 text-left">
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: tpl.color }}
                            />
                            <div>
                              <p className="font-bold text-slate-900">{tpl.name}</p>
                              <p className="text-xs text-slate-500">
                                {tpl.start}–{tpl.end}
                              </p>
                            </div>
                          </div>
                        </th>
                        {weekDays.map((day) => {
                          const slot = findSlot(slots, day.iso, tpl.id)
                          const mine = slot?.assignments.find((a) => a.staffId === myUserId)
                          const approved =
                            slot?.assignments.filter((a) => a.status === 'Approved') || []
                          const isFull = approved.length >= tpl.capacity
                          const isClosed = slot?.status === 'Closed' || (slot && slot.workDate < today)
                          const canPick = slot && !isClosed && !mine && !isFull
                          const isSelected = selectedSlotId === slot?.id

                          let cellTone = 'border-[#e7e8e0] bg-white hover:border-[#c1c9c0]'
                          if (isSelected) {
                            cellTone = 'border-[#356647] bg-[#356647]/10 ring-1 ring-[#356647]/40'
                          } else if (mine?.status === 'Approved') {
                            cellTone = 'border-emerald-300 bg-emerald-50'
                          } else if (mine?.status === 'Pending') {
                            cellTone = 'border-amber-300 bg-amber-50'
                          } else if (canPick) {
                            cellTone =
                              'border-dashed border-[#356647]/45 bg-white hover:bg-[#356647]/5'
                          } else if (isClosed || isFull) {
                            cellTone = 'border-slate-200 bg-slate-50 opacity-75'
                          }

                          return (
                            <td
                              key={`${day.iso}-${tpl.id}`}
                              className={`border-b border-[#e7e8e0] p-1.5 ${
                                day.isToday ? 'bg-[#356647]/[0.03]' : ''
                              }`}
                            >
                              <button
                                type="button"
                                disabled={!slot}
                                onClick={() => slot && setSelectedSlotId(slot.id)}
                                className={`flex min-h-[84px] w-full flex-col rounded-xl border px-2 py-2 text-left transition ${cellTone}`}
                              >
                                {mine ? (
                                  <>
                                    <span
                                      className={`text-[10px] font-bold uppercase ${
                                        mine.status === 'Approved'
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {mine.status === 'Approved' ? 'Ca của tôi' : 'Chờ duyệt'}
                                    </span>
                                    <span className="mt-1 truncate text-[11px] font-semibold text-slate-800">
                                      {shortName(mine.name || myName)}
                                    </span>
                                  </>
                                ) : canPick ? (
                                  <>
                                    <span className="text-[10px] font-bold uppercase text-[#356647]">
                                      Đăng ký
                                    </span>
                                    <span className="mt-1 text-[11px] text-slate-500">
                                      Còn {tpl.capacity - approved.length} chỗ
                                    </span>
                                  </>
                                ) : isFull ? (
                                  <span className="text-[11px] font-semibold text-slate-400">Đủ người</span>
                                ) : isClosed ? (
                                  <span className="text-[11px] font-semibold text-slate-400">Đã khóa</span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#e7e8e0] bg-[#fbf9f1] p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Ô đã chọn</p>
                {!selected ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Click một ô trên lịch — ô nét đứt xanh là còn chỗ để đăng ký.
                  </p>
                ) : (
                  <>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{selectedTpl?.name}</h3>
                    <p className="text-sm text-slate-600">
                      {formatWorkDate(selected.workDate)} · {selectedTpl?.start}–{selectedTpl?.end}
                    </p>

                    {myOnSelected ? (
                      <div className="mt-4 rounded-xl border border-[#e7e8e0] bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Trạng thái của bạn</p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(myOnSelected.status)}`}
                        >
                          {assignmentStatusLabel(myOnSelected.status)}
                        </span>
                      </div>
                    ) : canRegisterSelected() ? (
                      <button
                        type="button"
                        disabled={registering}
                        onClick={() => register(selected.id)}
                        className="mt-4 w-full rounded-xl bg-[#356647] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2d553b] disabled:opacity-60"
                      >
                        {registering ? 'Đang gửi…' : 'Đăng ký ca này'}
                      </button>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Không đăng ký được ô này (đã đủ, đã khóa, hoặc quá hạn).
                      </p>
                    )}

                    {selected.assignments.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Đang trong ca</p>
                        <ul className="mt-2 space-y-1">
                          {selected.assignments.map((a) => (
                            <li key={a.id || a.staffId} className="text-sm text-slate-700">
                              {shortName(a.name)}{' '}
                              <span className="text-xs text-slate-400">
                                ({assignmentStatusLabel(a.status)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    </PageShell>
  )
}

export default MyShiftsPage
