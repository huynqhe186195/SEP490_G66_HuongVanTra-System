import { useEffect, useRef, useState } from 'react'
import { LAYOUTS } from '../utils/endOfDayFilters.js'

/**
 * Thanh công cụ phía trên khung xem tài liệu báo cáo.
 *
 * Chỉ chứa thao tác trên tài liệu đang xem (tải lại, mở/thu gọn nhóm, chọn khổ, xuất/in).
 * Điều kiện lọc nằm hoàn toàn ở panel bên trái.
 */
function ReportViewerToolbar({
  title,
  loadedAtLabel,
  isLoading,
  isBusy,
  layout,
  onLayoutChange,
  onReload,
  onExpandAll,
  onCollapseAll,
  hasGroups,
  onExportExcel,
  onPrintA4,
  onPrintK80,
  onExportPdf,
  onOpenCriteria,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onClickAway = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [menuOpen])

  const run = (fn) => () => {
    setMenuOpen(false)
    fn?.()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c1c9c0]/60 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {onOpenCriteria && (
          <button
            type="button"
            onClick={onOpenCriteria}
            className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-2 py-1.5 text-sm text-[#414942] lg:hidden"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Tiêu chí
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[#1b1c17]">{title}</h2>
          <p className="text-[11px] text-[#717971]">
            {isLoading ? 'Đang tải…' : `Cập nhật: ${loadedAtLabel || '—'} · GMT+7`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {hasGroups && (
          <>
            <button
              type="button"
              onClick={onExpandAll}
              className="rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-medium text-[#414942] hover:bg-[#f6f4ec]"
            >
              Mở tất cả
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-medium text-[#414942] hover:bg-[#f6f4ec]"
            >
              Thu gọn
            </button>
          </>
        )}

        <div className="flex items-center rounded-lg border border-[#c1c9c0] p-0.5">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              type="button"
              title={`Khổ ${l.label.toLowerCase()}`}
              onClick={() => onLayoutChange(l.key)}
              className={`rounded-md px-2 py-1 ${
                layout === l.key ? 'bg-[#356647] text-white' : 'text-[#414942] hover:bg-[#f6f4ec]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] align-middle">{l.icon}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onReload}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-medium text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Tải lại
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isBusy}
            className="flex items-center gap-1 rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2b5239] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">ios_share</span>
            {isBusy ? 'Đang chuẩn bị…' : 'Xuất / In'}
            <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-[#c1c9c0] bg-white py-1 shadow-lg">
              {[
                { label: 'Xuất Excel', icon: 'table_view', fn: onExportExcel },
                { label: 'Xuất PDF', icon: 'picture_as_pdf', fn: onExportPdf },
                { label: 'In khổ A4', icon: 'print', fn: onPrintA4 },
                { label: 'In khổ K80', icon: 'receipt', fn: onPrintK80 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={run(item.fn)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#414942] hover:bg-[#f6f4ec]"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#356647]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportViewerToolbar
