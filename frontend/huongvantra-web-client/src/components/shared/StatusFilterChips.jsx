/**
 * Chip filter trạng thái theo thứ tự ưu tiên (chờ xử lý trước).
 * Đặt trên đầu vùng filter — thông tin/hành động quan trọng lên trước.
 *
 * options: [{ value, label, count? }]
 */
export default function StatusFilterChips({
  options = [],
  value = '',
  onChange,
  className = '',
  ariaLabel = 'Lọc theo trạng thái',
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
    >
      {options.map((option) => {
        const selected = String(value || '') === String(option.value || '')
        const count = option.count
        const hasCount = count != null && Number.isFinite(Number(count))
        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? 'border-[#356647] bg-[#356647] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#356647]/40 hover:bg-[#f6f4ec]'
            }`}
          >
            <span>{option.label}</span>
            {hasCount ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {Number(count)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
