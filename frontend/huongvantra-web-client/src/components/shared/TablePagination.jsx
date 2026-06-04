export const TABLE_PAGE_SIZE = 10

function TablePagination({
  page,
  pageSize = TABLE_PAGE_SIZE,
  totalCount,
  onPageChange,
  itemLabel = 'mục',
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalCount)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-[#f6f4ec]/60 px-4 py-3 sm:px-6 sm:py-4">
      <p className="text-sm text-slate-600">
        Hiển thị <span className="font-semibold text-slate-800">{from}–{to}</span> / {totalCount} {itemLabel}
        <span className="mx-2 text-slate-300">·</span>
        Trang {safePage}/{totalPages}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang trước"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>

        <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#538463] px-2 text-sm font-bold text-white">
          {safePage}
        </span>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang sau"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}

export default TablePagination
