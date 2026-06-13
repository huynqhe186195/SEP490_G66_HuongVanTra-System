import { getCategoryBreadcrumb } from '../utils/categoryTreeUtils.js'
import { getCategoryStatusMeta, isSyncedToStore } from '../utils/productDisplay.js'
import CategoryParentSelect from './CategoryParentSelect.jsx'

function CategoryTreeRow({
  node,
  depth,
  categories,
  expandedIds,
  onToggleExpand,
  editingId,
  editForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onHide,
  onRestore,
  onAddChild,
  editFieldErrors,
  canCreate,
  canHide,
  isWarehouse,
  isSaving,
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isEditing = editingId === node.id
  const status = getCategoryStatusMeta(node.isActive !== false, node.isDeleted)
  const parentLabel = node.parentId
    ? getCategoryBreadcrumb(node.parentId, categories) || '—'
    : 'Danh mục gốc'

  return (
    <>
      <tr className={node.isDeleted ? 'bg-slate-50/80 opacity-75' : undefined}>
        <td className="px-4 py-3 font-semibold text-slate-900">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              className={`flex size-6 shrink-0 items-center justify-center rounded text-slate-500 ${
                hasChildren ? 'hover:bg-slate-100' : 'invisible'
              }`}
              aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            >
              <span
                className={`material-symbols-outlined text-[18px] transition-transform ${
                  isExpanded ? '' : '-rotate-90'
                }`}
              >
                expand_more
              </span>
            </button>
            {isEditing ? (
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={editForm.name}
                onChange={(event) => onEditFormChange({ name: event.target.value })}
              />
            ) : (
              <div className="min-w-0 flex flex-wrap items-center gap-2">
                <span>{node.name}</span>
                {isWarehouse && !isSyncedToStore(node) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Chưa đồng bộ CH
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-slate-600">
          {isEditing ? (
            <CategoryParentSelect
              value={editForm.parentId}
              onChange={(parentId) => onEditFormChange({ parentId })}
              categories={categories}
              excludeId={node.id}
              error={editFieldErrors?.parentId}
            />
          ) : (
            <span className="text-sm">{parentLabel}</span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-600">
          {isEditing ? (
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editForm.description}
              onChange={(event) => onEditFormChange({ description: event.target.value })}
            />
          ) : (
            node.description || '—'
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </td>
        {canCreate || canHide ? (
          <td className="px-4 py-3 text-right">
            {isEditing ? (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  onClick={onCancelEdit}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  onClick={() => onSaveEdit(node)}
                >
                  Lưu
                </button>
              </div>
            ) : node.isDeleted ? (
              canHide ? (
                <button
                  type="button"
                  disabled={isSaving}
                  className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  onClick={() => onRestore(node)}
                >
                  Kích hoạt lại
                </button>
              ) : null
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                {canCreate ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-[#356647]/30 px-3 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5"
                      onClick={() => onAddChild(node)}
                    >
                      + Con
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      onClick={() => onStartEdit(node)}
                    >
                      Sửa
                    </button>
                  </>
                ) : null}
                {canHide ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    onClick={() => onHide(node)}
                  >
                    Ẩn
                  </button>
                ) : null}
              </div>
            )}
          </td>
        ) : null}
      </tr>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <CategoryTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              categories={categories}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              editingId={editingId}
              editForm={editForm}
              onEditFormChange={onEditFormChange}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onHide={onHide}
              onRestore={onRestore}
              onAddChild={onAddChild}
              editFieldErrors={editFieldErrors}
              canCreate={canCreate}
              canHide={canHide}
              isWarehouse={isWarehouse}
              isSaving={isSaving}
            />
          ))
        : null}
    </>
  )
}

export default function CategoryTreeTable({
  nodes,
  categories,
  expandedIds,
  onToggleExpand,
  editingId,
  editForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onHide,
  onRestore,
  onAddChild,
  editFieldErrors,
  canCreate,
  canHide,
  isWarehouse,
  isSaving,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Tên nhóm hàng</th>
            <th className="px-4 py-3 font-semibold">Thuộc nhóm</th>
            <th className="px-4 py-3 font-semibold">Mô tả</th>
            <th className="px-4 py-3 font-semibold">Trạng thái</th>
            {canCreate || canHide ? <th className="px-4 py-3 font-semibold text-right">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {nodes.map((node) => (
            <CategoryTreeRow
              key={node.id}
              node={node}
              depth={0}
              categories={categories}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              editingId={editingId}
              editForm={editForm}
              onEditFormChange={onEditFormChange}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onHide={onHide}
              onRestore={onRestore}
              onAddChild={onAddChild}
              editFieldErrors={editFieldErrors}
              canCreate={canCreate}
              canHide={canHide}
              isWarehouse={isWarehouse}
              isSaving={isSaving}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
