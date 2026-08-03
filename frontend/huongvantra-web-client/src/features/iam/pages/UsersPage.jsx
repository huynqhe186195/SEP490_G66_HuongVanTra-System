import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
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
import { normalizePhoneInput, getPhoneMaxLength, validateCreateAccountForm } from '../utils/accountValidation.js'

const EMPTY_CREATE = {
  username: '',
  password: '',
  fullName: '',
  phone: '',
  roleIds: [],
}

function isSameUserId(left, right) {
  if (!left || !right) return false
  return String(left).toLowerCase() === String(right).toLowerCase()
}

function userHasAdminRole(user) {
  return (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin')
}

const ADMIN_ACCOUNT_PROTECTED_MESSAGE =
  'Tài khoản Quản trị viên thuộc nhóm đặc quyền: trên trang này chỉ xem thông tin. Thay đổi hoặc thu hồi quyền cần quy trình vận hành riêng.'

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

function IconActionButton({ icon, label, variant = 'secondary', onClick }) {
  const styles =
    variant === 'danger'
      ? 'border-[#ba1a1a]/40 text-[#ba1a1a] hover:bg-[#fff5f5]'
      : variant === 'amber'
        ? 'border-[#b45309]/40 text-[#b45309] hover:bg-[#fffbeb]'
        : 'border-[#356647]/30 text-[#356647] hover:bg-[#356647]/5'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 bg-white transition-all active:scale-[0.96] ${styles}`}
    >
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
    </button>
  )
}

function UsersPage() {
  const session = useAuthSession()
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
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
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
    () => roles.filter((role) => role.roleName !== 'Sale' && role.roleName !== 'CooperativeOwner'),
    [roles],
  )

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE)
    setCreateFieldErrors({})
    setCreateOpen(true)
  }

  const openEdit = (user) => {
    if (userHasAdminRole(user)) {
      showError(ADMIN_ACCOUNT_PROTECTED_MESSAGE)
      return
    }
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
    if (userHasAdminRole(editUser)) {
      showError(ADMIN_ACCOUNT_PROTECTED_MESSAGE)
      return
    }
    if (editRoleIds.length === 0) {
      showError('Vui lòng chọn ít nhất một vai trò.')
      return
    }
    if (isSameUserId(editUser.id, session?.userId) && !editActive) {
      showError('Không thể khóa chính tài khoản đang đăng nhập.')
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
    if (userHasAdminRole(user) && user.isActive) {
      showError(ADMIN_ACCOUNT_PROTECTED_MESSAGE)
      return
    }
    if (isSameUserId(user.id, session?.userId) && user.isActive) {
      showError('Không thể khóa chính tài khoản đang đăng nhập.')
      return
    }

    const label = user.employee?.fullName || user.username
    try {
      if (user.isActive) {
        if (!(await confirmDialog({
          title: 'Khóa tài khoản',
          message: `Khóa tài khoản "${label}"?\n\nNgười này sẽ không đăng nhập được cho đến khi bạn mở khóa.`,
          tone: 'danger',
        }))) return
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
    if (userHasAdminRole(user)) {
      showError(ADMIN_ACCOUNT_PROTECTED_MESSAGE)
      return
    }
    if (isSameUserId(user.id, session?.userId)) {
      showError('Không thể ngừng sử dụng chính tài khoản đang đăng nhập.')
      return
    }

    const label = user.employee?.fullName || user.username
    if (!(await confirmDialog({ title: 'Ngừng sử dụng', message: SOFT_DELETE_CONFIRM.user(label), tone: 'danger' }))) return
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
    if (!(await confirmDialog({ title: 'Khôi phục', message: RESTORE_CONFIRM.user(label), tone: 'primary' }))) return
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
        compact
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

      {legacySaleReview.length > 0 ? (
        <InfoBox>
          <p className="rounded-xl border border-[#b45309]/40 bg-[#fffbeb] p-3 text-[#7c2d12]">
            <strong>Cần phân loại Sale legacy ({legacySaleReview.length}):</strong>{' '}
            {legacySaleReview.map((item) => item.username ?? item.Username).join(', ')}.
            Hãy sửa tài khoản và chọn SalePos, SaleCod hoặc cả hai; quyền POS an toàn hiện vẫn được giữ trong thời gian chờ.
          </p>
        </InfoBox>
      ) : null}


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
                  <div className="flex flex-wrap items-center gap-2">
                    <IconActionButton icon="visibility" label="Xem thông tin" onClick={() => setViewUser(user)} />
                    {userHasAdminRole(user) ? (
                      <IconActionButton
                        icon="verified_user"
                        label="Tài khoản Admin — chỉ xem"
                        variant="amber"
                        onClick={() => showError(ADMIN_ACCOUNT_PROTECTED_MESSAGE)}
                      />
                    ) : (
                      <>
                        <IconActionButton icon="edit" label="Sửa" onClick={() => openEdit(user)} />
                        {isSameUserId(user.id, session?.userId) ? (
                          <IconActionButton
                            icon="lock"
                            label="Không thể khóa tài khoản đang đăng nhập"
                            variant="amber"
                            onClick={() => showError('Không thể khóa chính tài khoản đang đăng nhập.')}
                          />
                        ) : (
                          <IconActionButton
                            icon={user.isActive ? 'lock' : 'lock_open'}
                            label={user.isActive ? 'Khóa' : 'Mở khóa'}
                            variant="amber"
                            onClick={() => handleLockToggle(user)}
                          />
                        )}
                        {isSameUserId(user.id, session?.userId) ? null : (
                          <IconActionButton
                            icon="person_off"
                            label="Ngừng sử dụng"
                            variant="danger"
                            onClick={() => handleSoftDelete(user)}
                          />
                        )}
                      </>
                    )}
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
            pageSizeOptions={pageSizeOptions}
            totalCount={totalCount}
            itemLabel="tài khoản"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
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
                ['phone', 'Số điện thoại', 'tel', 'Di động 10 số hoặc máy bàn 02… (11 số)', true],
              ].map(([field, label, type, placeholder, isPhone]) => (
                <label key={field} className="block">
                  <span className="text-base font-bold text-[#1b1c17]">{label}</span>
                  <input
                    type={type}
                    inputMode={isPhone ? 'numeric' : undefined}
                    maxLength={isPhone ? getPhoneMaxLength(createForm.phone) : undefined}
                    className={`mt-2 w-full rounded-2xl border-2 px-4 py-3 text-base ${
                      createFieldErrors[field] ? 'border-[#ba1a1a]' : 'border-[#c1c9c0]'
                    }`}
                    placeholder={placeholder}
                    value={createForm[field]}
                    onChange={handleCreateFieldChange(field)}
                  />
                  {isPhone ? (
                    <p className="mt-1 text-sm text-[#717971]">
                      Tuỳ chọn. Di động: 10 số (VD: 0901234567). Máy bàn: 11 số bắt đầu 02 (VD: 02838123456).
                    </p>
                  ) : null}
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
                  className="h-6 w-6 disabled:cursor-not-allowed disabled:opacity-50"
                  checked={editActive}
                  disabled={isSameUserId(editUser.id, session?.userId)}
                  title={isSameUserId(editUser.id, session?.userId) ? 'Không thể khóa chính tài khoản đang đăng nhập' : undefined}
                  onChange={(e) => {
                    if (isSameUserId(editUser.id, session?.userId) && !e.target.checked) {
                      showError('Không thể khóa chính tài khoản đang đăng nhập.')
                      return
                    }
                    setEditActive(e.target.checked)
                  }}
                />
              </label>
              {isSameUserId(editUser.id, session?.userId) ? (
                <p className="text-sm text-amber-800">Không thể tắt đăng nhập trên chính tài khoản đang dùng.</p>
              ) : null}
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

      {viewUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewUser(null)}>
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#717971]">Thông tin tài khoản</p>
                <h2 className="mt-1 text-2xl font-bold text-[#356647]">
                  {viewUser.employee?.fullName || viewUser.username}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
                onClick={() => setViewUser(null)}
                title="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <dl className="mt-6 space-y-3">
              {[
                ['Họ và tên', viewUser.employee?.fullName || '—'],
                ['Tên đăng nhập', viewUser.username],
                ['Vai trò', (viewUser.roles || []).map(formatRoleName).join(', ') || 'Chưa gán'],
                ['Phòng ban', viewUser.employee?.department || '—'],
                [
                  'Đăng nhập lần cuối',
                  viewUser.lastLoginAt ? new Date(viewUser.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có',
                ],
                ['Trạng thái', viewUser.isActive ? 'Đang hoạt động' : 'Đã khóa'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#f6f4ec] px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#717971]">{label}</dt>
                  <dd className="mt-1 text-base font-semibold text-[#1b1c17]">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <BigButton variant="secondary" onClick={() => setViewUser(null)}>
                Đóng
              </BigButton>
              {userHasAdminRole(viewUser) ? null : (
                <BigButton
                  onClick={() => {
                    const user = viewUser
                    setViewUser(null)
                    openEdit(user)
                  }}
                >
                  Sửa tài khoản
                </BigButton>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default UsersPage
