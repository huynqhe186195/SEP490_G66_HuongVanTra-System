import { Link } from 'react-router-dom'

/**
 * Hàng «Việc cần làm» — Link (`to`) hoặc button (`onClick`).
 * layout="horizontal" → các item xếp ngang thành một hàng.
 */
export default function OpsActionQueue({ items = [], title = 'Việc cần làm', className = '', layout = 'vertical' }) {
  const visible = items.filter((item) => item && (item.count == null || item.count > 0 || item.alwaysShow))
  if (!visible.length) return null

  const isHorizontal = layout === 'horizontal'

  return (
    <section className={`rounded-2xl border border-[#c1c9c0]/50 bg-white p-4 shadow-sm ${className}`.trim()}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1b1c17]">{title}</h3>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#717971]">
          Tiếp theo nên xử lý
        </span>
      </div>
      <ul className={isHorizontal ? 'flex divide-x divide-slate-100' : 'divide-y divide-slate-100'}>
        {visible.map((item) => {
          const body = (
            <>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg || 'bg-[#eaf4eb]'} ${item.iconColor || 'text-[#356647]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1b1c17]">{item.title}</p>
                {item.hint ? <p className="truncate text-xs text-[#717971]">{item.hint}</p> : null}
              </div>
              {item.count != null ? (
                <span className="rounded-full bg-[#356647]/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#356647]">
                  {item.count}
                </span>
              ) : null}
              <span className="material-symbols-outlined text-[18px] text-[#9aa39a]">chevron_right</span>
            </>
          )

          const rowClass = isHorizontal
            ? 'flex flex-1 items-center gap-3 px-3 py-2 text-left transition hover:bg-[#f6f4ec]/80 first:pl-0 last:pr-0'
            : 'flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-[#f6f4ec]/80'

          if (item.to) {
            return (
              <li key={item.id} className={isHorizontal ? 'flex flex-1 min-w-0' : ''}>
                <Link to={item.to} className={rowClass}>
                  {body}
                </Link>
              </li>
            )
          }

          return (
            <li key={item.id} className={isHorizontal ? 'flex flex-1 min-w-0' : ''}>
              <button type="button" onClick={item.onClick} className={rowClass}>
                {body}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
