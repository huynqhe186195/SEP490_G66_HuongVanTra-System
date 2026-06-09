import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateCatalog, canHideCatalog, canSyncCatalog } from '../../auth/utils/permissions.js'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  restoreCategory,
  updateCategory,
} from '../services/categoriesApi.js'
import { getCategoryStatusMeta } from '../utils/productDisplay.js'
import { validateCategoryForm } from '../utils/productValidation.js'

function ProductsPricingPage() {
  const [session, setSession] = useState(() => loadAuthSession())
  const canCreate = canCreateCatalog(session)
  const canHide = canHideCatalog(session)
  const canSync = canSyncCatalog(session)
  const [isSyncing, setIsSyncing] = useState(false)

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
  const [form, setForm] = useState({ name: '', description: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })

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

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredCategories = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    return categories.filter((item) => {
      if (statusFilter === 'hidden') return item.isDeleted
      if (item.isDeleted) return false
      if (statusFilter === 'active' && item.isActive === false) return false
      if (!keyword) return true
      const name = String(item.name || '').toLowerCase()
      const description = String(item.description || '').toLowerCase()
      return name.includes(keyword) || description.includes(keyword)
    })
  }, [categories, searchInput, statusFilter])

  async function handleCreate(event) {
    event.preventDefault()
    const validation = validateCategoryForm({
      name: form.name,
      description: form.description,
      existingCategories: categories,
    })
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    setIsSaving(true)
    try {
      await createCategory(form)
      showSuccess('Đã tạo danh mục mới.')
      setForm({ name: '', description: '' })
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
    setEditForm({ name: category.name || '', description: category.description || '' })
  }

  async function handleSaveEdit(category) {
    const validation = validateCategoryForm({
      name: editForm.name,
      description: editForm.description,
      categoryId: category.id,
      existingCategories: categories,
    })
    if (!validation.valid) {
      showError(validation.message)
      return
    }

    setIsSaving(true)
    try {
      await updateCategory(category.id, {
        name: editForm.name,
        description: editForm.description,
        parentId: category.parentId ?? null,
      })
      showSuccess('Đã cập nhật danh mục.')
      setEditingId(null)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
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
      await loadData()
      showSuccess('Đã đồng bộ danh mục mới nhất từ kho.')
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
            ? 'Thủ kho — tạo và quản lý danh mục sản phẩm'
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
        <section className="mb-6 rounded-[1rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
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
              <span className="text-xs font-semibold text-[#717971]">Mô tả</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Tùy chọn"
              />
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
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#356647]"
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
        ) : filteredCategories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Chưa có danh mục nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-4 py-3 font-semibold">Mô tả</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  {canCreate || canHide ? <th className="px-4 py-3 font-semibold text-right">Thao tác</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => {
                  const status = getCategoryStatusMeta(category.isActive !== false, category.isDeleted)
                  const isEditing = editingId === category.id

                  return (
                    <tr
                      key={category.id}
                      className={category.isDeleted ? 'bg-slate-50/80 opacity-75' : undefined}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {isEditing ? (
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, description: event.target.value }))
                            }
                          />
                        ) : (
                          category.description || '—'
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
                                onClick={() => setEditingId(null)}
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                onClick={() => handleSaveEdit(category)}
                              >
                                Lưu
                              </button>
                            </div>
                          ) : category.isDeleted ? (
                            canHide ? (
                              <button
                                type="button"
                                disabled={isSaving}
                                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                onClick={() => handleRestore(category)}
                              >
                                Kích hoạt lại
                              </button>
                            ) : null
                          ) : (
                            <div className="flex justify-end gap-2">
                              {canCreate ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                  onClick={() => startEdit(category)}
                                >
                                  Sửa
                                </button>
                              ) : null}
                              {canHide ? (
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                  onClick={() => handleHide(category)}
                                >
                                  Ẩn
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  )
}

export default ProductsPricingPage
