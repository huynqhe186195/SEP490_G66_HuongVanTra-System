import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canManageTaxonomy } from '../../auth/utils/permissions.js'
import {
  createBrand,
  deleteBrand,
  fetchBrands,
  restoreBrand,
  updateBrand,
} from '../services/brandsApi.js'

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
}

function ProductsBrandsPage() {
  const createFormRef = useRef(null)
  const [session, setSession] = useState(() => loadAuthSession())
  const canManage = canManageTaxonomy(session)

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  const [brands, setBrands] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [isSaving, setIsSaving] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await fetchBrands({
        isDeleted:
          statusFilter === 'hidden' ? true : statusFilter === 'active' ? false : undefined,
      })
      setBrands(items)
    } catch (error) {
      showError(error.message)
      setBrands([])
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const visibleBrands = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    const filtered = brands.filter((item) => {
      if (statusFilter === 'hidden' && !item.isDeleted) return false
      if (statusFilter === 'active' && (item.isDeleted || item.isActive === false)) return false
      if (keyword && !item.name.toLowerCase().includes(keyword)) return false
      return true
    })
    return filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      return b.id - a.id
    })
  }, [brands, statusFilter, searchInput])

  const totalCount = visibleBrands.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedBrands = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleBrands.slice(start, start + pageSize)
  }, [visibleBrands, page, pageSize])

  const selectedBrand = useMemo(
    () => brands.find((item) => item.id === selectedId) ?? null,
    [brands, selectedId],
  )

  async function handleCreate(event) {
    event.preventDefault()
    const name = createName.trim()
    if (name.length < 2) {
      setCreateError('Tên nhãn phải có ít nhất 2 ký tự.')
      return
    }
    if (name.length > 200) {
      setCreateError('Tên nhãn tối đa 200 ký tự.')
      return
    }
    setIsSaving(true)
    try {
      await createBrand(name)
      showSuccess('Đã tạo nhãn mới.')
      setCreateName('')
      setCreateError('')
      setStatusFilter('active')
      setPage(1)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(brand) {
    setEditingId(brand.id)
    setEditName(brand.name || '')
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditError('')
  }

  async function handleSaveEdit(brand) {
    const name = editName.trim()
    if (name.length < 2) {
      setEditError('Tên nhãn phải có ít nhất 2 ký tự.')
      return
    }
    if (name.length > 200) {
      setEditError('Tên nhãn tối đa 200 ký tự.')
      return
    }
    setIsSaving(true)
    try {
      await updateBrand(brand.id, { name })
      showSuccess('Đã cập nhật nhãn.')
      cancelEdit()
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleHide(brand) {
    if (brand.isDeleted) return
    if (!(await confirmDialog({
      title: 'Ngừng sử dụng nhãn',
      message: `Ngừng sử dụng nhãn "${brand.name}"? Có thể khôi phục lại sau.`,
      tone: 'danger',
    }))) return

    setIsSaving(true)
    try {
      await deleteBrand(brand.id)
      showSuccess('Đã ngừng sử dụng nhãn.')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestore(brand) {
    if (!brand.isDeleted) return
    if (!(await confirmDialog({
      title: 'Khôi phục nhãn',
      message: `Khôi phục nhãn "${brand.name}"?`,
      tone: 'primary',
    }))) return

    setIsSaving(true)
    try {
      await restoreBrand(brand.id)
      showSuccess('Đã khôi phục nhãn.')
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
        compact
        title="Quản lý Nhãn"
        titleInfo={
          canManage
            ? 'Tạo và quản lý nhãn (thương hiệu) sản phẩm'
            : 'Xem danh sách nhãn sản phẩm'
        }
        searchPlaceholder="Tìm nhãn..."
        searchValue={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value)
          setPage(1)
        }}
        rightContent={
          <Link
            to="/products/categories"
            className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            <span className="material-symbols-outlined text-[18px]">category</span>
            Danh mục sản phẩm
          </Link>
        }
      />

      {canManage ? (
        <section
          ref={createFormRef}
          className="mb-6 rounded-[1rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="text-lg font-bold text-slate-800">Thêm nhãn mới</h2>
          <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start" onSubmit={handleCreate}>
            <label className="block flex-1 space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Tên nhãn *</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value)
                  setCreateError('')
                }}
                placeholder="VD: Cocoon"
              />
              {createError ? <p className="text-xs text-[#b42318]">{createError}</p> : null}
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50 sm:mt-6"
            >
              {isSaving ? 'Đang lưu...' : 'Tạo nhãn'}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Danh sách nhãn</h2>
          <select
            className="h-11 min-w-[200px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-700 outline-none focus:border-[#356647]"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="hidden">Đã ngừng</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : totalCount === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            {searchInput.trim() ? 'Không tìm thấy nhãn phù hợp.' : 'Chưa có nhãn nào.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Tên nhãn</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5">Ngày tạo</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBrands.map((brand) => {
                    const isEditing = editingId === brand.id
                    return (
                      <tr key={brand.id} className="border-b border-slate-100 align-middle">
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/15"
                                value={editName}
                                onChange={(event) => {
                                  setEditName(event.target.value)
                                  setEditError('')
                                }}
                                autoFocus
                              />
                              {editError ? <p className="text-xs text-[#b42318]">{editError}</p> : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedId(brand.id)}
                              className="font-semibold text-slate-800 hover:text-[#356647] hover:underline"
                            >
                              {brand.name}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {brand.isDeleted ? (
                            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Đã ngừng</span>
                          ) : brand.isActive === false ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Tạm ẩn</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Đang hoạt động</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{formatDateTime(brand.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleSaveEdit(brand)}
                                  className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : canManage ? (
                              <>
                                {!brand.isDeleted ? (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(brand)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Sửa
                                  </button>
                                ) : null}
                                {brand.isDeleted ? (
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleRestore(brand)}
                                    className="rounded-lg border border-[#356647]/30 px-3 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50"
                                  >
                                    Khôi phục
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleHide(brand)}
                                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    Ngừng sử dụng
                                  </button>
                                )}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="nhãn"
            />
          </>
        )}
      </section>

      {selectedBrand ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết nhãn</h3>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Mã (Id)</dt>
                <dd className="text-slate-800">{selectedBrand.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Tên nhãn</dt>
                <dd className="text-right text-slate-800">{selectedBrand.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Đang kích hoạt</dt>
                <dd className="text-slate-800">{selectedBrand.isActive ? 'Có' : 'Không'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Đã ngừng</dt>
                <dd className="text-slate-800">{selectedBrand.isDeleted ? 'Có' : 'Không'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Ngày tạo</dt>
                <dd className="text-slate-800">{formatDateTime(selectedBrand.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">Ngày cập nhật</dt>
                <dd className="text-slate-800">{formatDateTime(selectedBrand.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default ProductsBrandsPage
