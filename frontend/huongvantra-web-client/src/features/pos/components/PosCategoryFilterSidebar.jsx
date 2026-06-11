import { useEffect, useMemo, useState } from 'react'
import {
  buildCategoryTree,
  collectDescendantIds,
  collectTreeNodeIds,
  filterCategoryTree,
} from '../../products/utils/categoryTreeUtils.js'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function CategoryTreeNode({
  node,
  categories,
  depth = 0,
  selectedIds,
  expandedIds,
  onToggleExpand,
  onToggleSelect,
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedIds.has(node.id)
  const descendantIds = collectDescendantIds(node.id, categories)
  const selectedDescendants = descendantIds.filter((id) => selectedIds.has(id)).length
  const isIndeterminate = !isSelected && selectedDescendants > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-lg py-1 pr-2 hover:bg-[#f6f4ec]"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          className={`flex size-6 shrink-0 items-center justify-center rounded text-[#717971] ${
            hasChildren ? 'hover:bg-[#eae8e0]' : 'invisible'
          }`}
          aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
        >
          <Icon className={`text-[18px] transition-transform ${isExpanded ? '' : '-rotate-90'}`}>
            expand_more
          </Icon>
        </button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={isSelected}
            ref={(element) => {
              if (element) element.indeterminate = isIndeterminate
            }}
            onChange={() => onToggleSelect(node.id)}
            className="size-4 shrink-0 rounded border-[#c1c9c0] text-[#356647] focus:ring-[#356647]/30"
          />
          <span className="truncate text-sm font-medium text-[#1b1c17]">{node.name}</span>
        </label>
      </div>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              categories={categories}
              depth={depth + 1}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
            />
          ))
        : null}
    </div>
  )
}

export default function PosCategoryFilterSidebar({
  isOpen,
  categories = [],
  selectedIds = [],
  onClose,
  onSkip,
  onConfirm,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [draftIds, setDraftIds] = useState(() => new Set(selectedIds))
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])
  const visibleTree = useMemo(
    () => filterCategoryTree(categoryTree, searchTerm),
    [categoryTree, searchTerm],
  )

  useEffect(() => {
    if (!isOpen) return
    setSearchTerm('')
    setDraftIds(new Set(selectedIds))
    setExpandedIds(new Set(collectTreeNodeIds(categoryTree)))
  }, [isOpen, selectedIds, categoryTree])

  useEffect(() => {
    if (!searchTerm.trim()) return
    setExpandedIds(new Set(collectTreeNodeIds(visibleTree)))
  }, [searchTerm, visibleTree])

  if (!isOpen) return null

  function toggleExpand(id) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelect(id) {
    setDraftIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearAll() {
    setDraftIds(new Set())
  }

  function handleConfirm() {
    onConfirm?.(Array.from(draftIds))
  }

  const allSelected = draftIds.size === 0
  const selectedCount = draftIds.size

  return (
    <>
      <button
        type="button"
        aria-label="Đóng lọc nhóm hàng"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col border-l border-[#c1c9c0] bg-[#fbf9f1] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-category-filter-title"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Lọc sản phẩm</p>
            <h3 id="pos-category-filter-title" className="text-lg font-bold text-[#1b1c17]">
              Lọc theo nhóm hàng
            </h3>
            {selectedCount > 0 ? (
              <p className="mt-0.5 text-xs font-semibold text-[#356647]">Đã chọn {selectedCount} nhóm</p>
            ) : (
              <p className="mt-0.5 text-xs text-[#717971]">Chọn một hoặc nhiều nhóm</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
            aria-label="Đóng"
          >
            <Icon className="text-[24px]">close</Icon>
          </button>
        </header>

        <div className="shrink-0 border-b border-[#f0eee6] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm font-semibold text-[#414942]">Nhóm hàng</span>
            <div className="relative min-w-0 flex-1">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">search</Icon>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm nhóm hàng"
                className="w-full rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
              />
            </div>
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-3 py-2">
          <label
            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#f6f4ec]"
            style={{ paddingLeft: '32px' }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={clearAll}
              className="size-4 rounded border-[#c1c9c0] text-[#356647] focus:ring-[#356647]/30"
            />
            <span className="text-sm font-semibold text-[#1b1c17]">Tất cả</span>
          </label>

          {visibleTree.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#717971]">Không tìm thấy nhóm hàng.</p>
          ) : (
            visibleTree.map((node) => (
              <CategoryTreeNode
                key={node.id}
                node={node}
                categories={categories}
                selectedIds={draftIds}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
              />
            ))
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e4e3db] bg-[#f6f4ec] px-4 py-4">
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#717971] hover:text-[#ba1a1a]"
          >
            <Icon className="text-[18px]">delete</Icon>
            Xóa chọn tất cả
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-[#356647] px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-xl bg-[#356647] px-4 py-2.5 text-sm font-bold text-white hover:brightness-110"
            >
              Xong{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}
