/**
 * Strip KPI gọn cho trang thống kê / hàng chờ.
 * item: { id, label, value, note?, warn?, active?, onClick? }
 */
export default function OpsSnapshotStrip({ items = [], className = '' }) {
  if (!items.length) return null

  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 ${className}`.trim()}>
      {items.map((item) => {
        const Tag = item.onClick ? 'button' : 'div'
        return (
          <Tag
            key={item.id}
            type={item.onClick ? 'button' : undefined}
            onClick={item.onClick}
            className={`rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition ${
              item.active
                ? 'border-[#356647] ring-1 ring-[#356647]/30'
                : item.warn
                  ? 'border-rose-200 hover:border-rose-300'
                  : 'border-slate-200 hover:border-slate-300'
            } ${item.onClick ? 'cursor-pointer' : ''}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${item.warn ? 'text-rose-700' : 'text-slate-900'}`}>
              {item.value}
            </p>
            {item.note ? (
              <p className="mt-0.5 truncate text-[11px] text-slate-500" title={item.note}>
                {item.note}
              </p>
            ) : null}
          </Tag>
        )
      })}
    </div>
  )
}
