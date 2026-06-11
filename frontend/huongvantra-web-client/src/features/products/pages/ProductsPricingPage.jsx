import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateCatalog, canHideCatalog, canSyncCatalog, isWarehouseRole } from '../../auth/utils/permissions.js'
import CategoryParentSelect from '../components/CategoryParentSelect.jsx'
import CategoryTreeTable from '../components/CategoryTreeTable.jsx'
import { fetchPendingCatalogSync, syncCatalogToStore } from '../services/catalogSyncApi.js'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  restoreCategory,
  updateCategory,
} from '../services/categoriesApi.js'
import {
  buildCategoryTree,
  collectTreeNodeIds,
  filterCategoryTree,
} from '../utils/categoryTreeUtils.js'
import { validateCategoryForm } from '../utils/productValidation.js'

const EMPTY_FORM = { name: '', description: '', parentId: '' }

function ProductsPricingPage() {
  const createFormRef = useRef(null)
  const [session, setSession] = useState(() => loadAuthSession())
  const canCreate = canCreateCatalog(session)
  const canHide = canHideCatalog(session)
  const canSync = canSyncCatalog(session)
  const isWarehouse = isWarehouseRole(session)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingSyncTotal, setPendingSyncTotal] = useState(0)

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editFieldErrors, setEditFieldErrors] = useState({})
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await fetchCategories({
        isDeleted: statusFilter === 'hidden' ? true : undefined,
      })
      setCategories(items)
    } catch (error) {
      showError(error.message)
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  const loadPendingSync = useCallback(async () => {
    if (!canSync) {
      setPendingSyncTotal(0)
      return
    }
    try {
      const pending = await fetchPendingCatalogSync()
      setPendingSyncTotal(pending.total)
    } catch {
      setPendingSyncTotal(0)
    }
  }, [canSync])

  useEffect(() => {
    loadData()
    loadPendingSync()
  }, [loadData, loadPendingSync])

  const visibleCategories = useMemo(() => {
    return categories.filter((item) => {
      if (statusFilter === 'hidden') return item.isDeleted
      if (item.isDeleted) return false
      if (statusFilter === 'active' && item.isActive === false) return false
      return true
    })
  }, [categories, statusFilter])

  const categoryTree = useMemo(() => buildCategoryTree(visibleCategories), [visibleCategories])

  const visibleTree = useMemo(
    () => filterCategoryTree(categoryTree, searchInput),
    [categoryTree, searchInput],
  )

  useEffect(() => {
    setExpandedIds(new Set(collectTreeNodeIds(visibleTree)))
  }, [visibleTree])

  function toggleExpand(categoryId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  async function handleCreate(event) {
    event.preventDefault()
    const parentId = form.parentId ? Number(form.parentId) : null
    const validation = validateCategoryForm({
      name: form.name,
      description: form.description,
      parentId,
      existingCategories: categories,
    })
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    setIsSaving(true)
    try {
      await createCategory({
        name: form.name,
        description: form.description,
        parentId,
      })
      showSuccess('Đã tạo danh mục mới.')
      setForm(EMPTY_FORM)
      setFieldErrors({})
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(category) {
    setEditingId(category.id)
    setEditForm({
      name: category.name || '',
      description: category.description || '',
      parentId: category.parentId ? String(category.parentId) : '',
    })
    setEditFieldErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
    setEditFieldErrors({})
  }

  function handleEditFormChange(patch) {
    setEditForm((prev) => ({ ...prev, ...patch }))
    if (patch.parentId !== undefined) {
      setEditFieldErrors((prev) => ({ ...prev, parentId: undefined }))
    }
    if (patch.name !== undefined) {
      setEditFieldErrors((prev) => ({ ...prev, name: undefined }))
    }
  }

  async function handleSaveEdit(category) {
    const parentId = editForm.parentId ? Number(editForm.parentId) : null
    const validation = validateCategoryForm({
      name: editForm.name,
      description: editForm.description,
      parentId,
      categoryId: category.id,
      existingCategories: categories,
    })
    if (!validation.valid) {
      setEditFieldErrors(validation.errors)
      if (validation.message) showError(validation.message)
      return
    }

    setIsSaving(true)
    try {
      await updateCategory(category.id, {
        name: editForm.name,
        description: editForm.description,
        parentId,
      })
      showSuccess('Đã cập nhật danh mục.')
      cancelEdit()
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function startAddChild(parentCategory) {
    setForm({
      name: '',
      description: '',
      parentId: String(parentCategory.id),
    })
    setFieldErrors({})
    setExpandedIds((prev) => new Set([...prev, parentCategory.id]))
    createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleHide(category) {
    if (category.isDeleted) return
    if (!window.confirm(`Ẩn danh mục "${category.name}"? Có thể kích hoạt lại sau.`)) return

    setIsSaving(true)
    try {
      await deleteCategory(category.id)
      showSuccess('Đã ẩn danh mục.')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSyncCatalog() {
    setIsSyncing(true)
    try {
      const result = await syncCatalogToStore()
      await Promise.all([loadData(), loadPendingSync()])
      const total = result.categoriesSynced + result.productsSynced + result.skusSynced
      if (total === 0) {
        showSuccess('Không có dữ liệu mới từ kho cần đồng bộ.')
      } else {
        showSuccess(
          `Đã đồng bộ ${result.categoriesSynced} danh mục, ${result.productsSynced} sản phẩm, ${result.skusSynced} SKU từ kho.`,
        )
      }
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleRestore(category) {
    if (!category.isDeleted) return
    if (!window.confirm(`Kích hoạt lại danh mục "${category.name}"?`)) return

    setIsSaving(true)
    try {
      await restoreCategory(category.id)
      showSuccess('Đã kích hoạt lại danh mục.')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Danh mục sản phẩm"
        description={
          canCreate
            ? 'Thủ kho — tạo và quản lý danh mục sản phẩm theo cấu trúc cha — con'
            : 'Xem danh mục — bấm Đồng bộ để tải dữ liệu mới từ kho'
        }
        searchPlaceholder="Tìm danh mục..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <>
            {canSync ? (
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncCatalog}
                className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                Đồng bộ dữ liệu
                {pendingSyncTotal > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{pendingSyncTotal}</span>
                ) : null}
              </button>
            ) : null}
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              Danh sách sản phẩm
            </Link>
          </>
        }
      />

      {canCreate ? (
        <section
          ref={createFormRef}
          className="mb-6 rounded-[1rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="text-lg font-bold text-slate-800">Thêm danh mục mới</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <label className="block space-y-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[#717971]">Tên danh mục *</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="VD: Trà xanh"
              />
              {fieldErrors.name ? <p className="text-xs text-[#b42318]">{fieldErrors.name}</p> : null}
            </label>
            <label className="block space-y-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[#717971]">Danh mục cha</span>
              <CategoryParentSelect
                value={form.parentId}
                onChange={(parentId) => setForm((prev) => ({ ...prev, parentId }))}
                categories={categories}
                error={fieldErrors.parentId}
              />
            </label>
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold text-[#717971]">Mô tả</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Tùy chọn"
              />
              {fieldErrors.description ? <p className="text-xs text-[#b42318]">{fieldErrors.description}</p> : null}
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Tạo danh mục'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Danh sách danh mục</h2>
          <select
            className="h-11 min-w-[200px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-700 outline-none focus:border-[#356647]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : visibleTree.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            {searchInput.trim() ? 'Không tìm thấy danh mục phù hợp.' : 'Chưa có danh mục nào.'}
          </p>
        ) : (
          <CategoryTreeTable
            nodes={visibleTree}
            categories={categories}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            editingId={editingId}
            editForm={editForm}
            onEditFormChange={handleEditFormChange}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={handleSaveEdit}
            onHide={handleHide}
            onRestore={handleRestore}
            onAddChild={startAddChild}
            editFieldErrors={editFieldErrors}
            canCreate={canCreate}
            canHide={canHide}
            isWarehouse={isWarehouse}
            isSaving={isSaving}
          />
        )}
      </section>
    </PageShell>
  )
}

export default ProductsPricingPage
