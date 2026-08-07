/** Các mảnh giao diện dùng chung cho các tab của Báo cáo cuối ngày. */

export function Card({ title, subtitle, icon, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm ${className}`}>
      {title && (
        <header className="mb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#1b1c17]">
            {icon && <span className="material-symbols-outlined text-[18px] text-[#356647]">{icon}</span>}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#717971]">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function DataTable({ columns, rows, renderRow, emptyText = 'Không có phát sinh', footer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#c1c9c0]/60">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#717971] ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#c1c9c0]/30 text-[#414942]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-[#717971]">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map(renderRow)
          )}
        </tbody>
        {footer && <tfoot className="border-t-2 border-[#c1c9c0]/60 font-bold text-[#1b1c17]">{footer}</tfoot>}
      </table>
    </div>
  )
}

/**
 * Thanh phân trang cho các bảng chi tiết. Số tổng luôn lấy từ backend (tính trên toàn kỳ),
 * không suy ra từ số dòng đang hiển thị.
 */
export function Pagination({ page, totalPages, totalCount, unitLabel = 'dòng', isLoading, onChange }) {
  if (!totalPages || totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#c1c9c0]/40 px-3 py-2">
      <p className="text-xs text-[#717971]">
        Trang {page}/{totalPages}
        {totalCount != null ? ` · ${totalCount} ${unitLabel} toàn kỳ` : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading || page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] disabled:opacity-40"
        >
          Trang trước
        </button>
        <button
          type="button"
          disabled={isLoading || page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] disabled:opacity-40"
        >
          Trang sau
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ text = 'Không có giao dịch phù hợp với bộ lọc đã chọn.', hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c1c9c0] bg-[#fbf9f1] p-10 text-center">
      <span className="material-symbols-outlined text-[32px] text-[#c1c9c0]">inbox</span>
      <p className="text-sm text-[#717971]">{text}</p>
      {hint && <p className="max-w-md text-xs text-[#717971]">{hint}</p>}
      {action}
    </div>
  )
}
