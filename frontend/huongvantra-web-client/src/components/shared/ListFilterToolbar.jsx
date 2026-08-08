/**
 * Thanh lọc gọn dưới PageHeader — một hàng flex-wrap thống nhất cho trang danh sách kho.
 */
export const listFilterControlClass =
  'min-h-[32px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-[#356647] focus:ring-1 focus:ring-[#356647]/20'

export default function ListFilterToolbar({ children, meta = null, className = '' }) {
  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm ${className}`.trim()}
    >
      {children}
      {meta ? (
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500">
          {meta}
        </div>
      ) : null}
    </div>
  )
}
