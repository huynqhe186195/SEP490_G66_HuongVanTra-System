import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showSuccess } from '../../../app/toast.js'
import {
  SHIFT_TEMPLATES,
  MOCK_STOCKTAKE_LINKED,
  assignmentStatusLabel,
  buildMockWeekSlots,
  findSlot,
  formatWeekRange,
  formatWorkDate,
  getTemplate,
  getWeekDays,
  shortName,
} from '../data/mockShiftData.js'

function statusTone(status) {
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-900'
  if (status === 'Pending') return 'bg-amber-100 text-amber-900'
  if (status === 'Rejected') return 'bg-rose-100 text-rose-900'
  return 'bg-slate-100 text-slate-600'
}

function ShiftManagePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [areaFilter, setAreaFilter] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState(null)

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const [slots, setSlots] = useState(() => buildMockWeekSlots(getWeekDays(0)))

  // Khi đổi tuần, seed lại lưới demo
  const reloadWeek = (nextOffset) => {
    setWeekOffset(nextOffset)
    const days = getWeekDays(nextOffset)
    setSlots(buildMockWeekSlots(days))
    setSelectedSlotId(null)
  }

  const templates = useMemo(() => {
    return SHIFT_TEMPLATES.filter((t) => !areaFilter || t.area === areaFilter)
  }, [areaFilter])

  const selected = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId],
  )
  const selectedTpl = selected ? getTemplate(selected.templateId) : null

  const stats = useMemo(() => {
    const relevant = slots.filter((s) => {
      const tpl = getTemplate(s.templateId)
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
  }, [slots, areaFilter])

  const updateAssignment = (slotId, staffId, status) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot
        return {
          ...slot,
          assignments: slot.assignments.map((a) =>
            a.staffId === staffId ? { ...a, status } : a,
          ),
        }
      }),
    )
    showSuccess(status === 'Approved' ? 'Đã duyệt đăng ký ca (prototype).' : 'Đã từ chối (prototype).')
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Phân ca làm"
        description="Prototype — lịch tuần dạng thời khóa biểu (ngày × khung ca)."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[#414942]">
          <span>Nhân sự</span>
          <span>/</span>
          <span className="font-semibold text-[#356647]">Phân ca</span>
          <span className="ml-2 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            UI demo · thời khóa biểu
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#356647] sm:text-3xl">Lịch ca theo tuần</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#414942]">
              Cột = ngày, hàng = khung ca. Click ô để duyệt đăng ký. Dễ thấy chỗ trống / chờ duyệt hơn danh sách
              dọc.
            </p>
          </div>
          <Link
            to="/my-shifts"
            className="rounded-xl border border-[#c1c9c0] px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Góc nhân viên
          </Link>
        </div>

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

          <div className="inline-flex rounded-xl border border-slate-200 bg-[#fbf9f1] p-1">
            {[
              { value: '', label: 'Tất cả' },
              { value: 'Shelf', label: 'Quầy' },
              { value: 'Warehouse', label: 'Kho' },
            ].map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => setAreaFilter(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  areaFilter === opt.value
                    ? 'bg-white text-[#356647] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

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
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#f6f4ec]">
                  <th className="sticky left-0 z-10 w-40 border-b border-r border-[#e7e8e0] bg-[#f6f4ec] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                {templates.map((tpl) => (
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
                            {tpl.start}–{tpl.end} · max {tpl.capacity}
                          </p>
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
                                  key={`${slot.id}-${a.staffId}`}
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
                ))}
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
                        <li key={a.staffId} className="rounded-xl border border-[#e7e8e0] bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">{a.name}</p>
                              <p className="text-xs text-slate-500">{a.role}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(a.status)}`}>
                              {assignmentStatusLabel(a.status)}
                            </span>
                          </div>
                          {a.status === 'Pending' && selected.status !== 'Closed' ? (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => updateAssignment(selected.id, a.staffId, 'Approved')}
                                className="rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d553b]"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAssignment(selected.id, a.staffId, 'Rejected')}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-[#356647]/25 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">
                Lưu vết kiểm kê (minh họa)
              </p>
              <div className="mt-3 rounded-xl bg-[#f6f4ec] p-4 text-sm">
                <p className="font-mono font-bold text-[#356647]">{MOCK_STOCKTAKE_LINKED.requestCode}</p>
                <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Ca gắn phiếu</p>
                <p className="font-semibold text-slate-900">
                  {MOCK_STOCKTAKE_LINKED.shiftCode} · {MOCK_STOCKTAKE_LINKED.shiftWindow}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Người kiểm kê</p>
                <p className="font-semibold text-slate-900">{MOCK_STOCKTAKE_LINKED.createdByName}</p>
              </div>
              <Link
                to="/inventory/stocktake"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#356647] hover:underline"
              >
                Tới kiểm kê
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="rounded-2xl border border-dashed border-[#c1c9c0] px-4 py-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Chú thích:</span> xanh = đã duyệt · vàng = chờ duyệt ·
              ô nét đứt = trống · ô xám = đã khóa
            </div>
          </aside>
        </div>
      </section>
    </PageShell>
  )
}

export default ShiftManagePage
