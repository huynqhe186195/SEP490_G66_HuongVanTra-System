import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canManageProducts } from '../../auth/utils/permissions.js'
import { createCategory, fetchCategories, setCategoryStatus, updateCategory } from '../services/categoriesApi.js'
import { getCategoryStatusMeta } from '../utils/productDisplay.js'
import { mapProductApiError, validateCategoryForm } from '../utils/productValidation.js'

const EMPTY_FORM = {
  name: '',
  description: '',
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function ProductsPricingPage() {
  const session = loadAuthSession()
  const canManage = canManageProducts(session)

  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [togglingId, setTogglingId] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await fetchCategories()
      setCategories(items)
    } catch (error) {
      showError(error.message)
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredCategories = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    return categories.filter((item) => {
      if (statusFilter === 'active' && item.isActive === false) return false
      if (statusFilter === 'inactive' && item.isActive !== false) return false
      if (!keyword) return true
      const name = String(item.name || '').toLowerCase()
      const description = String(item.description || '').toLowerCase()
      return name.includes(keyword) || description.includes(keyword)
    })
  }, [categories, searchInput, statusFilter])

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

  function startEdit(category) {
    setEditingId(category.id)
    setForm({
      name: category.name || '',
      description: category.description || '',
    })
    setFieldErrors({})
  }

  function updateField(key) {
    return (event) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canManage) return

    const validation = validateCategoryForm({ ...form, categoryId: editingId, existingCategories: categories })
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    const payload = {
      name: form.name,
      description: form.description,
      parentId: null,
    }

    try {
      setIsSaving(true)
      if (editingId) {
        await updateCategory(editingId, payload)
        showSuccess('Đã cập nhật danh mục.')
      } else {
        await createCategory(payload)
        showSuccess('Đã thêm danh mục.')
      }
      resetForm()
      await loadData()
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))
      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
      showError(mapped.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleStatus(category) {
    if (!canManage) return
    const nextActive = category.isActive === false
    if (!window.confirm(`${nextActive ? 'Kích hoạt' : 'Ngừng hoạt động'} danh mục "${category.name}"?`)) return
    try {
      setTogglingId(category.id)
      await setCategoryStatus(category, nextActive)
      showSuccess(nextActive ? 'Đã kích hoạt lại danh mục.' : 'Đã ngừng hoạt động danh mục.')
      if (editingId === category.id && !nextActive) resetForm()
      await loadData()
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      showError(mapped.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Danh mục sản phẩm"
        description="Danh mục phẳng (Trà xanh, Trà đen, Phụ kiện...). Tên danh mục không được trùng."
        searchPlaceholder="Tìm danh mục..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Danh sách sản phẩm
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {canManage ? (
          <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:col-span-4 lg:p-8">
            <h2 className="mb-4 text-lg font-bold text-slate-800">{editingId ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Tên danh mục *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.name ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  value={form.name}
                  onChange={updateField('name')}
                />
                <FieldError message={fieldErrors.name} />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Mô tả</span>
                <textarea
                  className={`min-h-[88px] w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.description ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  value={form.description}
                  onChange={updateField('description')}
                />
                <FieldError message={fieldErrors.description} />
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
                  {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm danh mục'}
                </button>
                {editingId ? (
                  <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={resetForm}>
                    Hủy
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        <section className={`rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8 ${canManage ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-800">Danh sách danh mục</h2>
            <select
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#356647]"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : filteredCategories.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Chưa có danh mục nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tên</th>
                    <th className="px-4 py-3 font-semibold">Mô tả</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    {canManage ? <th className="px-4 py-3 font-semibold">Thao tác</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((category) => {
                    const status = getCategoryStatusMeta(category.isActive !== false)
                    return (
                    <tr key={category.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{category.name}</td>
                      <td className="px-4 py-3 text-slate-600">{category.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-sm font-semibold text-[#356647] hover:underline" onClick={() => startEdit(category)}>
                              Sửa
                            </button>
                            <button
                              type="button"
                              disabled={togglingId === category.id}
                              className={`text-sm font-semibold hover:underline disabled:opacity-50 ${
                                category.isActive !== false ? 'text-[#7e5700]' : 'text-[#356647]'
                              }`}
                              onClick={() => handleToggleStatus(category)}
                            >
                              {category.isActive !== false ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                            </button>
                          </div>
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
      </div>
    </PageShell>
  )
}

export default ProductsPricingPage
