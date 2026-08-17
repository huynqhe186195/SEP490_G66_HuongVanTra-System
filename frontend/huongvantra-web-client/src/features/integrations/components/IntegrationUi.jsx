export function HubSegment({ label, value, onChange, options = [] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label || 'Bộ lọc'}
        className="inline-flex w-fit rounded-full border border-[#c5d7c4] bg-[#f7faf6] p-1"
      >
        {options.map((option) => {
          const selected = value === option.id
          return (
            <button
              key={option.id || 'all'}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? 'bg-[#2f5d3a] text-white shadow-sm'
                  : 'text-[#356647] hover:bg-white/80'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StatusPill({ status }) {
  const ok = status === 'Hoạt động' || status === 'Đã gửi'
  const bad = status === 'Lỗi' || status === 'Cần cấu hình'
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
        bad
          ? 'bg-rose-50 text-rose-700'
          : ok
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-800'
      }`}
    >
      {status}
    </span>
  )
}

export function DetailBox({ label, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-[#fbf9f1]/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{children}</div>
    </div>
  )
}
