import { useEffect, useRef, useState } from 'react'

export const TABLE_PAGE_SIZE = 10
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50]

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'right-ellipsis']
  }

  if (currentPage >= totalPages - 2) {
    return ['left-ellipsis', totalPages - 2, totalPages - 1, totalPages]
  }

  return ['left-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'right-ellipsis']
}

function TablePagination({
  page,
  pageSize = TABLE_PAGE_SIZE,
  totalCount,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  itemLabel = 'bản ghi',
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
}) {
  const normalizedTotalCount = Math.max(0, Number(totalCount) || 0)
  const normalizedPageSize = Math.max(1, Number(pageSize) || TABLE_PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(normalizedTotalCount / normalizedPageSize))
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const from = normalizedTotalCount === 0 ? 0 : (safePage - 1) * normalizedPageSize + 1
  const to = Math.min(safePage * normalizedPageSize, normalizedTotalCount)
  const paginationItems = getPaginationItems(safePage, totalPages)
  const [jumpPopoverKey, setJumpPopoverKey] = useState(null)
  const [jumpPageInput, setJumpPageInput] = useState('')
  const [jumpPopoverPosition, setJumpPopoverPosition] = useState(null)
  const popoverRef = useRef(null)
  const closeTimerRef = useRef(null)
  const buttonClass =
    'inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
  const pageButtonClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:border-[#538463] disabled:bg-[#538463] disabled:text-white disabled:opacity-100'

  useEffect(() => {
    if (!jumpPopoverKey) return undefined

    function handlePointerDown(event) {
      if (!popoverRef.current?.contains(event.target)) {
        setJumpPopoverKey(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [jumpPopoverKey])

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    setJumpPopoverKey(null)
    setJumpPageInput('')
    setJumpPopoverPosition(null)
  }, [safePage, totalPages])

  function handlePageSizeChange(event) {
    if (disabled) return
    const nextPageSize = Number(event.target.value)
    if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) return
    onPageSizeChange?.(nextPageSize)
    onPageChange?.(1)
  }

  function getDefaultJumpPage(ellipsisKey) {
    if (ellipsisKey === 'left-ellipsis') return Math.max(1, safePage - 3)
    return Math.min(totalPages, safePage + 3)
  }

  function getPopoverPosition(anchorElement) {
    const rect = anchorElement.getBoundingClientRect()
    const viewportPadding = 12
    const estimatedHalfWidth = 88
    const left = Math.min(
      window.innerWidth - viewportPadding - estimatedHalfWidth,
      Math.max(viewportPadding + estimatedHalfWidth, rect.left + rect.width / 2),
    )

    return {
      left,
      top: Math.max(viewportPadding, rect.top - 8),
    }
  }

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleCloseJumpPopover() {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeJumpPopover()
    }, 160)
  }

  function openJumpPopover(ellipsisKey, anchorElement) {
    if (disabled) return
    clearCloseTimer()
    setJumpPopoverKey(ellipsisKey)
    setJumpPageInput(String(getDefaultJumpPage(ellipsisKey)))
    if (anchorElement) {
      setJumpPopoverPosition(getPopoverPosition(anchorElement))
    }
  }

  function toggleJumpPopover(ellipsisKey, anchorElement) {
    if (disabled) return
    clearCloseTimer()
    if (jumpPopoverKey === ellipsisKey) {
      setJumpPopoverKey(null)
      setJumpPageInput('')
      setJumpPopoverPosition(null)
      return
    }

    openJumpPopover(ellipsisKey, anchorElement)
  }

  function closeJumpPopover() {
    clearCloseTimer()
    setJumpPopoverKey(null)
    setJumpPageInput('')
    setJumpPopoverPosition(null)
  }

  function submitJumpPage() {
    if (disabled) return

    const parsedPage = Number(jumpPageInput)
    if (!Number.isFinite(parsedPage)) return

    const targetPage = Math.min(totalPages, Math.max(1, Math.trunc(parsedPage)))
    onPageChange?.(targetPage)
    closeJumpPopover()
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-[#f6f4ec]/60 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-1 text-xs text-slate-600 sm:text-sm">
        <p>
          <span className="font-semibold text-slate-800">{from}-{to}</span> / {normalizedTotalCount} {itemLabel}
          <span className="mx-1.5 text-slate-300 sm:mx-2">·</span>
          Trang {safePage}/{totalPages}
        </p>
        <p>Tổng: {normalizedTotalCount} bản ghi</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
            <span>Hiển thị</span>
            <select
              className="h-9 min-w-[72px] rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-[#538463]"
              value={normalizedPageSize}
              onChange={handlePageSizeChange}
              disabled={disabled}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>bản ghi/trang</span>
          </label>
        ) : null}

        <button
          type="button"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange?.(1)}
          className={buttonClass}
          aria-label="Trang đầu"
        >
          Đầu
        </button>

        <button
          type="button"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
          className={buttonClass}
          aria-label="Trang trước"
        >
          Trước
        </button>

        {paginationItems.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              disabled={disabled || item === safePage}
              onClick={() => onPageChange?.(item)}
              className={pageButtonClass}
              aria-current={item === safePage ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              ref={jumpPopoverKey === item ? popoverRef : null}
              className="inline-flex"
              onMouseEnter={(event) => openJumpPopover(item, event.currentTarget)}
              onMouseLeave={() => {
                if (jumpPopoverKey === item) scheduleCloseJumpPopover()
              }}
            >
              <button
                type="button"
                disabled={disabled}
                title="Đi tới trang bất kỳ"
                onClick={(event) => toggleJumpPopover(item, event.currentTarget)}
                className="inline-flex h-9 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-expanded={jumpPopoverKey === item}
              >
                ...
              </button>
              {jumpPopoverKey === item ? (
                <span
                  className="fixed z-[9999] w-44 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl"
                  onMouseEnter={clearCloseTimer}
                  onMouseLeave={scheduleCloseJumpPopover}
                  style={{
                    left: jumpPopoverPosition ? `${jumpPopoverPosition.left}px` : '50%',
                    top: jumpPopoverPosition ? `${jumpPopoverPosition.top}px` : '0px',
                  }}
                >
                  <label className="block text-xs font-bold text-slate-500">
                    Đi tới trang
                    <input
                      type="text"
                      inputMode="numeric"
                      value={jumpPageInput}
                      onChange={(event) => setJumpPageInput(event.target.value.replace(/\D/g, ''))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          submitJumpPage()
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#538463]/15"
                      placeholder={`1 - ${totalPages}`}
                    />
                  </label>
                  <p className="mt-1 text-[11px] font-medium text-slate-400">1 - {totalPages}</p>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={submitJumpPage}
                      className="rounded-lg bg-[#538463] px-3 py-1 text-xs font-bold text-white hover:bg-[#457053]"
                    >
                      Đi
                    </button>
                  </div>
                </span>
              ) : null}
            </span>
          ),
        )}

        <button
          type="button"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
          className={buttonClass}
          aria-label="Trang sau"
        >
          Tiếp
        </button>

        <button
          type="button"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange?.(totalPages)}
          className={buttonClass}
          aria-label="Trang cuối"
        >
          Cuối
        </button>
      </div>
    </div>
  )
}

export default TablePagination
