import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import ViewTabs from '../components/ViewTabs.jsx'
import { fetchRoles, mapRole } from '../services/rolesApi.js'
import {
  createUser,
  fetchLegacySaleReview,
  fetchUsers,
  lockUser,
  mapUser,
  restoreUser,
  softDeleteUser,
  unlockUser,
  updateUser,
} from '../services/usersApi.js'
import { RESTORE_CONFIRM, SOFT_DELETE_CONFIRM, formatRoleName } from '../utils/iamLabels.js'
import { normalizePhoneInput, validateCreateAccountForm } from '../utils/accountValidation.js'

const EMPTY_CREATE = {
  username: '',
  password: '',
  fullName: '',
  phone: '',
  roleIds: [],
}

function InfoBox({ children }) {
  return (
    <div className="mb-6 rounded-2xl border-2 border-[#356647]/20 bg-[#f6f4ec] px-5 py-4 text-base leading-relaxed text-[#1b1c17]">
      {children}
    </div>
  )
}

function BigButton({ children, variant = 'primary', className = '', ...props }) {
  const styles =
    variant === 'danger'
      ? 'border-2 border-[#ba1a1a] bg-white text-[#ba1a1a] hover:bg-[#fff5f5]'
      : variant === 'secondary'
        ? 'border-2 border-[#356647] bg-white text-[#356647] hover:bg-[#356647]/5'
        : variant === 'amber'
          ? 'border-2 border-[#b45309] bg-white text-[#b45309] hover:bg-[#fffbeb]'
          : 'border-2 border-[#356647] bg-[#356647] text-white hover:brightness-110'

  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'restore' ? 'restore' : 'active'

  const [users, setUsers] = useState([])
  const [deletedUsers, setDeletedUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [legacySaleReview, setLegacySaleReview] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [editRoleIds, setEditRoleIds] = useState([])
  const [editActive, setEditActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [createFieldErrors, setCreateFieldErrors] = useState({})

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [rolesData, usersData, deletedData, legacyReviewData] = await Promise.all([
        fetchRoles(),
        fetchUsers({ page, pageSize, search: search.trim() || undefined }),
        fetchUsers({ page: 1, pageSize: 100, onlyDeleted: true }),
        fetchLegacySaleReview(),
      ])
      setRoles((Array.isArray(rolesData) ? rolesData : []).map(mapRole).filter(Boolean))
      setUsers((usersData.items || []).map(mapUser).filter(Boolean))
      setDeletedUsers((deletedData.items || []).map(mapUser).filter(Boolean))
      setLegacySaleReview(Array.isArray(legacyReviewData) ? legacyReviewData : [])
      setTotalCount(usersData.totalCount || 0)
    } catch (error) {
      setUsers([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    // loadData owns the asynchronous state transition for this dependency change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return users
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(keyword) ||
        (user.employee?.fullName || '').toLowerCase().includes(keyword),
    )
  }, [users, search])

  const filteredDeletedUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return deletedUsers
    return deletedUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(keyword) ||
        (user.employee?.fullName || '').toLowerCase().includes(keyword),
    )
  }, [deletedUsers, search])

  const setView = (nextView) => {
    setSearchParams(nextView === 'restore' ? { view: 'restore' } : {}, { replace: true })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.roleName !== 'Sale'),
    [roles],
  )

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE)
    setCreateFieldErrors({})
    setCreateOpen(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setEditRoleIds(
      assignableRoles
        .filter((role) => user.roles.includes(role.roleName))
        .map((role) => role.id),
    )
    setEditActive(user.isActive)
  }

  const handleCreateFieldChange = (field) => (event) => {
    const value = field === 'phone' ? normalizePhoneInput(event.target.value) : event.target.value
    setCreateForm((current) => ({ ...current, [field]: value }))
    setCreateFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const toggleCreateRoleId = (roleId) => {
    const id = Number(roleId)
    if (!Number.isFinite(id)) return
    setCreateForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(id)
        ? current.roleIds.filter((value) => value !== id)
        : [...current.roleIds, id],
    }))
    setCreateFieldErrors((current) => ({ ...current, roleIds: undefined }))
  }

  const toggleEditRoleId = (roleId) => {
    const id = Number(roleId)
    if (!Number.isFinite(id)) return
    setEditRoleIds((current) => (
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    ))
  }

  const handleCreate = async () => {
    const validation = validateCreateAccountForm(createForm)
    if (!validation.valid) {
      setCreateFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    setIsSaving(true)
    try {
      await createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        roleIds: createForm.roleIds,
        fullName: createForm.fullName.trim(),
        department: null,
        actualSalary: 0,
        bankAccountInfo: createForm.phone.trim() || null,
      })
      showSuccess('Đã tạo tài khoản mới.')
      setCreateOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editUser) return
    if (editRoleIds.length === 0) {
      showError('Vui lòng chọn ít nhất một vai trò.')
      return
    }

    setIsSaving(true)
    try {
      await updateUser(editUser.id, { isActive: editActive, roleIds: editRoleIds })
      showSuccess('Đã lưu thay đổi tài khoản.')
      setEditUser(null)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLockToggle = async (user) => {
    const label = user.employee?.fullName || user.username
    try {
      if (user.isActive) {
        if (!window.confirm(`Khóa tài khoản "${label}"?\n\nNgười này sẽ không đăng nhập được cho đến khi bạn mở khóa.`)) return
        await lockUser(user.id)
        showSuccess('Đã khóa tài khoản.')
      } else {
        await unlockUser(user.id)
        showSuccess('Đã mở khóa tài khoản.')
      }
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleSoftDelete = async (user) => {
    const label = user.employee?.fullName || user.username
    if (!window.confirm(SOFT_DELETE_CONFIRM.user(label))) return
    try {
      await softDeleteUser(user.id)
      showSuccess(`Đã ngừng sử dụng tài khoản "${label}". Chuyển sang tab Khôi phục.`)
      setView('restore')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleRestore = async (user) => {
    const label = user.employee?.fullName || user.username
    if (!window.confirm(RESTORE_CONFIRM.user(label))) return
    try {
      await restoreUser(user.id)
      showSuccess(`Đã khôi phục tài khoản "${label}".`)
      setView('active')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Quản lý tài khoản đăng nhập"
        titleInfo="Thêm, sửa, khóa hoặc ngừng sử dụng tài khoản — chữ to, thao tác rõ ràng"
        rightContent={
          view === 'active' ? (
            <BigButton onClick={openCreate}>
              <span className="material-symbols-outlined text-[24px]">person_add</span>
              Thêm tài khoản
            </BigButton>
          ) : null
        }
      />

      <InfoBox>
        <p><strong>Tab Đang sử dụng:</strong> quản lý tài khoản đang hoạt động.</p>
        <p><strong>Tab Khôi phục:</strong> xem tài khoản đã ngừng sử dụng và bấm <strong>Khôi phục</strong> để dùng lại.</p>
        <p className="mt-1"><strong>Khóa:</strong> tạm chặn đăng nhập. <strong>Ngừng sử dụng:</strong> chuyển sang tab Khôi phục.</p>
        {legacySaleReview.length > 0 ? (
          <p className="mt-3 rounded-xl border border-[#b45309]/40 bg-[#fffbeb] p-3 text-[#7c2d12]">
            <strong>Cần phân loại Sale legacy ({legacySaleReview.length}):</strong>{' '}
            {legacySaleReview.map((item) => item.username ?? item.Username).join(', ')}.
            Hãy sửa tài khoản và chọn SalePos, SaleCod hoặc cả hai; quyền POS an toàn hiện vẫn được giữ trong thời gian chờ.
          </p>
        ) : null}
      </InfoBox>

      <div className="mb-6">
        <ViewTabs view={view} onViewChange={setView} restoreCount={deletedUsers.length} />
      </div>

      <section className="rounded-[24px] border-2 border-[#c1c9c0]/40 bg-white p-6 shadow-sm">
        {view === 'restore' ? (
          <>
            <h2 className="mb-4 text-2xl font-bold text-[#356647]">Khôi phục tài khoản</h2>
            <p className="mb-6 text-base text-[#414942]">
              Danh sách tài khoản đã ngừng sử dụng. Bấm <strong>Khôi phục</strong> để đưa về tab Đang sử dụng.
            </p>
            {isLoading ? (
              <p className="py-10 text-center text-lg text-[#414942]">Đang tải...</p>
            ) : filteredDeletedUsers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#c1c9c0] bg-[#fbf9f1] py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-[#717971]">inventory_2</span>
                <p className="mt-3 text-lg font-semibold text-[#414942]">Chưa có tài khoản cần khôi phục</p>
                <p className="mt-1 text-base text-[#717971]">Khi bạn bấm &quot;Ngừng sử dụng&quot;, tài khoản sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDeletedUsers.map((user) => (
                  <article
                    key={user.id}
                    className="flex flex-col gap-4 rounded-2xl border-2 border-[#717971]/30 bg-[#f6f4ec] p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-[#414942]">{user.employee?.fullName || user.username}</h3>
                      <p className="mt-1 text-base text-[#717971]">Tên đăng nhập: {user.username}</p>
                      <span className="mt-2 inline-flex rounded-full bg-[#ffdad6] px-3 py-1 text-sm font-bold text-[#93000a]">
                        Đã ngừng sử dụng
                      </span>
                    </div>
                    <BigButton variant="secondary" onClick={() => handleRestore(user)}>
                      <span className="material-symbols-outlined text-[24px]">restore</span>
                      Khôi phục
                    </BigButton>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
        <div className="relative mb-6 max-w-xl">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[24px] text-[#414942]">search</span>
          <input
            className="w-full rounded-2xl border-2 border-[#c1c9c0] py-4 pl-12 pr-4 text-base outline-none focus:border-[#356647]"
            placeholder="Gõ tên đăng nhập hoặc họ tên..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-lg text-[#414942]">Đang tải danh sách...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="py-10 text-center text-lg text-[#414942]">Không có tài khoản nào.</p>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border-2 border-[#c1c9c0]/40 bg-[#fbf9f1]/40 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#356647]/15 text-[#356647]">
                      <span className="material-symbols-outlined text-[32px]">person</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#1b1c17]">
                        {user.employee?.fullName || user.username}
                      </h3>
                      <p className="mt-1 text-base text-[#414942]">
                        Tên đăng nhập: <strong>{user.username}</strong>
                      </p>
                      <p className="mt-1 text-base text-[#356647]">
                        Vai trò: {(user.roles || []).map(formatRoleName).join(', ') || 'Chưa gán'}
                      </p>
                      <p className="mt-1 text-sm text-[#717971]">
                        Đăng nhập lần cuối:{' '}
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có'}
                      </p>
                      <span
                        className={`mt-3 inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${
                          user.isActive
                            ? 'bg-[#baefc8] text-[#00210f]'
                            : 'bg-[#ffdad6] text-[#93000a]'
                        }`}
                      >
                        {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:flex-col xl:flex-row">
                    <BigButton variant="secondary" className="flex-1 lg:flex-none" onClick={() => openEdit(user)}>
                      Sửa
                    </BigButton>
                    <BigButton variant="amber" className="flex-1 lg:flex-none" onClick={() => handleLockToggle(user)}>
                      {user.isActive ? 'Khóa' : 'Mở khóa'}
                    </BigButton>
                    <BigButton variant="danger" className="flex-1 lg:flex-none" onClick={() => handleSoftDelete(user)}>
                      Ngừng sử dụng
                    </BigButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[#c1c9c0]/40">
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            itemLabel="tài khoản"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-3 text-base text-[#414942]">
          <span>Trang {page} / {totalPages} — Tổng {totalCount} tài khoản</span>
          <div className="flex gap-2">
            <BigButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trang trước
            </BigButton>
            <BigButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Trang sau
            </BigButton>
          </div>
        </div>
          </>
        )}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold text-[#356647]">Thêm tài khoản mới</h2>
            <div className="mt-6 space-y-4">
              {[
                ['username', 'Tên đăng nhập', 'text', 'VD: nv01', false],
                ['password', 'Mật khẩu (≥6 ký tự)', 'password', '', false],
                ['fullName', 'Họ và tên', 'text', 'VD: Nguyễn Văn A', false],
                ['phone', 'Số điện thoại', 'tel', '0xxxxxxxxx (tùy chọn)', true],
              ].map(([field, label, type, placeholder, isPhone]) => (
                <label key={field} className="block">
                  <span className="text-base font-bold text-[#1b1c17]">{label}</span>
                  <input
                    type={type}
                    inputMode={isPhone ? 'numeric' : undefined}
                    maxLength={isPhone ? 10 : undefined}
                    className={`mt-2 w-full rounded-2xl border-2 px-4 py-3 text-base ${
                      createFieldErrors[field] ? 'border-[#ba1a1a]' : 'border-[#c1c9c0]'
                    }`}
                    placeholder={placeholder}
                    value={createForm[field]}
                    onChange={handleCreateFieldChange(field)}
                  />
                  {createFieldErrors[field] ? (
                    <p className="mt-1 text-sm text-[#ba1a1a]">{createFieldErrors[field]}</p>
                  ) : null}
                </label>
              ))}
              <fieldset>
                <legend className="text-base font-bold text-[#1b1c17]">Chọn một hoặc nhiều vai trò</legend>
                <div className="mt-3 space-y-2">
                  {assignableRoles.map((role) => (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${
                        createForm.roleIds.includes(role.id) ? 'border-[#356647] bg-[#356647]/5' : 'border-[#c1c9c0]/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[#356647]"
                        checked={createForm.roleIds.includes(role.id)}
                        onChange={() => toggleCreateRoleId(role.id)}
                      />
                      <span className="text-base font-semibold">{formatRoleName(role.roleName)}</span>
                    </label>
                  ))}
                </div>
                {createFieldErrors.roleIds ? (
                  <p className="mt-2 text-sm text-[#ba1a1a]">{createFieldErrors.roleIds}</p>
                ) : null}
              </fieldset>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <BigButton variant="secondary" onClick={() => setCreateOpen(false)}>Hủy bỏ</BigButton>
              <BigButton disabled={isSaving} onClick={handleCreate}>
                {isSaving ? 'Đang lưu...' : 'Tạo tài khoản'}
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold text-[#356647]">Sửa tài khoản</h2>
            <p className="mt-2 text-base text-[#414942]">{editUser.username}</p>
            <div className="mt-6 space-y-4">
              <label className="flex items-center justify-between rounded-2xl border-2 border-[#c1c9c0]/60 p-4">
                <span className="text-base font-bold">Cho phép đăng nhập</span>
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
              </label>
              <fieldset>
                <legend className="text-base font-bold text-[#1b1c17]">Vai trò (có thể chọn nhiều)</legend>
                <div className="mt-3 space-y-2">
                  {assignableRoles.map((role) => (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${
                        editRoleIds.includes(role.id) ? 'border-[#356647] bg-[#356647]/5' : 'border-[#c1c9c0]/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[#356647]"
                        checked={editRoleIds.includes(role.id)}
                        onChange={() => toggleEditRoleId(role.id)}
                      />
                      <span className="text-base font-semibold">{formatRoleName(role.roleName)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <BigButton variant="secondary" onClick={() => setEditUser(null)}>Hủy bỏ</BigButton>
              <BigButton disabled={isSaving} onClick={handleUpdate}>
                {isSaving ? 'Đang lưu...' : 'Lưu lại'}
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default UsersPage
