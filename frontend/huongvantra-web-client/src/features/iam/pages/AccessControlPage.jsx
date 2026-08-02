import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import ViewTabs from '../components/ViewTabs.jsx'
import { createPermission, fetchPermissions, mapPermission, restorePermission, softDeletePermission } from '../services/permissionsApi.js'
import {
  createRole,
  fetchRoleById,
  fetchRolePermissions,
  fetchRoles,
  mapRole,
  restoreRole,
  softDeleteRole,
  updateRole,
} from '../services/rolesApi.js'
import {
  RESTORE_CONFIRM,
  SOFT_DELETE_CONFIRM,
  formatPermissionName,
  formatRoleDescription,
  formatRoleName,
  getPermissionHint,
  isRetiredRoleName,
} from '../utils/iamLabels.js'

const TAB_ROLES = 'vai-tro'
const TAB_PERMISSIONS = 'quyen'

const EMPTY_ROLE_FORM = {
  roleName: '',
  description: '',
  permissionIds: [],
}

function InfoBox({ children }) {
  return (
    <div className="rounded-2xl border-2 border-[#356647]/20 bg-[#f6f4ec] px-5 py-4 text-base leading-relaxed text-[#1b1c17]">
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
        : 'border-2 border-[#356647] bg-[#356647] text-white hover:brightness-110'

  return (
    <button
      type="button"
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function AccessControlPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === TAB_PERMISSIONS ? TAB_PERMISSIONS : TAB_ROLES
  const view = searchParams.get('view') === 'restore' ? 'restore' : 'active'

  const [roles, setRoles] = useState([])
  const [deletedRoles, setDeletedRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [deletedPermissions, setDeletedPermissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM)
  const [isSavingRole, setIsSavingRole] = useState(false)

  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [permissionFormName, setPermissionFormName] = useState('')
  const [isSavingPermission, setIsSavingPermission] = useState(false)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  const setTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  const setView = (nextView) => {
    setSearchParams(
      nextView === 'restore' ? { tab: activeTab, view: 'restore' } : { tab: activeTab },
      { replace: true },
    )
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [rolesData, deletedRolesData, permissionsData, deletedPermissionsData] = await Promise.all([
        fetchRoles(),
        fetchRoles({ onlyDeleted: true }),
        fetchPermissions(),
        fetchPermissions({ onlyDeleted: true }),
      ])
      setRoles((Array.isArray(rolesData) ? rolesData : []).map(mapRole).filter((role) => role && !isRetiredRoleName(role.roleName)))
      setDeletedRoles((Array.isArray(deletedRolesData) ? deletedRolesData : []).map(mapRole).filter((role) => role && !isRetiredRoleName(role.roleName)))
      setPermissions((Array.isArray(permissionsData) ? permissionsData : []).map(mapPermission).filter(Boolean))
      setDeletedPermissions((Array.isArray(deletedPermissionsData) ? deletedPermissionsData : []).map(mapPermission).filter(Boolean))
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredPermissions = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase()
    if (!keyword) return permissions
    return permissions.filter((item) => {
      const label = formatPermissionName(item.permissionName).toLowerCase()
      return label.includes(keyword) || item.permissionName.toLowerCase().includes(keyword)
    })
  }, [permissions, permissionSearch])

  const filteredDeletedPermissions = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase()
    if (!keyword) return deletedPermissions
    return deletedPermissions.filter((item) => {
      const label = formatPermissionName(item.permissionName).toLowerCase()
      return label.includes(keyword) || item.permissionName.toLowerCase().includes(keyword)
    })
  }, [deletedPermissions, permissionSearch])

  const openCreateRole = () => {
    setEditingRoleId(null)
    setRoleForm(EMPTY_ROLE_FORM)
    setRoleModalOpen(true)
  }

  const openEditRole = async (role) => {
    setEditingRoleId(role.id)
    setRoleModalOpen(true)
    try {
      const [detail, rolePermissions] = await Promise.all([
        fetchRoleById(role.id),
        fetchRolePermissions(role.id),
      ])
      const mapped = mapRole(detail)
      const permissionIds = (Array.isArray(rolePermissions) ? rolePermissions : [])
        .map(mapPermission)
        .filter(Boolean)
        .map((item) => item.id)

      setRoleForm({
        roleName: mapped?.roleName || role.roleName,
        description: mapped?.description || role.description || '',
        permissionIds,
      })
    } catch (error) {
      showError(error.message)
      setRoleForm({
        roleName: role.roleName,
        description: role.description || '',
        permissionIds: [],
      })
    }
  }

  const toggleRolePermission = (permissionId) => {
    setRoleForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }))
  }

  const handleSaveRole = async () => {
    if (!roleForm.roleName.trim()) {
      showError('Vui lòng nhập tên vai trò.')
      return
    }

    const payload = {
      roleName: roleForm.roleName.trim(),
      description: roleForm.description.trim() || null,
      permissionIds: roleForm.permissionIds,
    }

    setIsSavingRole(true)
    try {
      if (editingRoleId) {
        await updateRole(editingRoleId, payload)
        showSuccess('Đã lưu thay đổi vai trò.')
      } else {
        await createRole(payload)
        showSuccess('Đã thêm vai trò mới.')
      }
      setRoleModalOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleSoftDeleteRole = async (role) => {
    const displayName = formatRoleName(role.roleName)
    if (!(await confirmDialog({ title: 'Ngừng sử dụng', message: SOFT_DELETE_CONFIRM.role(displayName), tone: 'danger' }))) return
    try {
      await softDeleteRole(role.id)
      showSuccess(`Đã ngừng sử dụng vai trò "${displayName}". Chuyển sang tab Khôi phục.`)
      setView('restore')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleRestoreRole = async (role) => {
    const displayName = formatRoleName(role.roleName)
    if (!(await confirmDialog({ title: 'Khôi phục', message: RESTORE_CONFIRM.role(displayName), tone: 'primary' }))) return
    try {
      await restoreRole(role.id)
      showSuccess(`Đã khôi phục vai trò "${displayName}".`)
      setView('active')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleCreatePermission = async () => {
    const code = permissionFormName.trim().toUpperCase().replace(/\s+/g, '_')
    if (!code) {
      showError('Vui lòng nhập mã quyền (ví dụ: TAO_DON).')
      return
    }

    setIsSavingPermission(true)
    try {
      await createPermission(code)
      showSuccess('Đã thêm quyền mới.')
      setPermissionFormName('')
      setPermissionModalOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSavingPermission(false)
    }
  }

  const handleSoftDeletePermission = async (permission) => {
    const displayName = formatPermissionName(permission.permissionName)
    if (!(await confirmDialog({ title: 'Ngừng sử dụng', message: SOFT_DELETE_CONFIRM.permission(displayName), tone: 'danger' }))) return
    try {
      await softDeletePermission(permission.id)
      showSuccess(`Đã ngừng sử dụng quyền "${displayName}". Chuyển sang tab Khôi phục.`)
      setView('restore')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  const handleRestorePermission = async (permission) => {
    const displayName = formatPermissionName(permission.permissionName)
    if (!(await confirmDialog({ title: 'Khôi phục', message: RESTORE_CONFIRM.permission(displayName), tone: 'primary' }))) return
    try {
      await restorePermission(permission.id)
      showSuccess(`Đã khôi phục quyền "${displayName}".`)
      setView('active')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Phân quyền hệ thống"
        titleInfo="Thiết lập vai trò (nhóm người dùng) và quyền thao tác — giao diện đơn giản, chữ to, dễ thao tác"
        rightContent={(
          <BigButton variant="secondary" onClick={() => setGuideOpen(true)}>
            <span className="material-symbols-outlined text-[24px]">help</span>
            Hướng dẫn nhanh
          </BigButton>
        )}
      />

      <div className="mt-4 w-full rounded-2xl border-2 border-[#c1c9c0]/40 bg-white p-1.5 shadow-sm sm:max-w-lg">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setTab(TAB_ROLES)}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:text-base ${
              activeTab === TAB_ROLES
                ? 'bg-[#356647] text-white shadow-sm'
                : 'bg-transparent text-[#356647] hover:bg-[#356647]/5'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] sm:text-[24px]">groups</span>
            Vai trò
          </button>
          <button
            type="button"
            onClick={() => setTab(TAB_PERMISSIONS)}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:text-base ${
              activeTab === TAB_PERMISSIONS
                ? 'bg-[#356647] text-white shadow-sm'
                : 'bg-transparent text-[#356647] hover:bg-[#356647]/5'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] sm:text-[24px]">verified_user</span>
            Quyền thao tác
          </button>
        </div>
      </div>

      {activeTab === TAB_ROLES ? (
        <section className="mt-6 rounded-[24px] border-2 border-[#c1c9c0]/40 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-[#356647]">
                {view === 'restore' ? 'Khôi phục vai trò' : 'Danh sách vai trò'}
              </h2>
              {view === 'active' ? (
                <BigButton onClick={openCreateRole}>
                  <span className="material-symbols-outlined text-[24px]">add</span>
                  Thêm vai trò
                </BigButton>
              ) : null}
            </div>
            <ViewTabs view={view} onViewChange={setView} restoreCount={deletedRoles.length} />
          </div>

          {view === 'restore' ? (
            isLoading ? (
              <p className="py-8 text-center text-lg text-[#414942]">Đang tải dữ liệu...</p>
            ) : deletedRoles.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#c1c9c0] bg-[#fbf9f1] py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-[#717971]">inventory_2</span>
                <p className="mt-3 text-lg font-semibold text-[#414942]">Chưa có vai trò cần khôi phục</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {deletedRoles.map((role) => (
                  <article
                    key={role.id}
                    className="flex flex-col gap-4 rounded-2xl border-2 border-[#717971]/30 bg-[#f6f4ec] p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-[#414942]">{formatRoleName(role.roleName)}</h3>
                      <p className="text-sm text-[#717971]">Mã: {role.roleName}</p>
                    </div>
                    <BigButton variant="secondary" onClick={() => handleRestoreRole(role)}>
                      <span className="material-symbols-outlined text-[24px]">restore</span>
                      Khôi phục
                    </BigButton>
                  </article>
                ))}
              </div>
            )
          ) : isLoading ? (
            <p className="py-8 text-center text-lg text-[#414942]">Đang tải dữ liệu...</p>
          ) : roles.length === 0 ? (
            <p className="py-8 text-center text-lg text-[#414942]">Chưa có vai trò nào. Bấm &quot;Thêm vai trò&quot; để bắt đầu.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {roles.map((role) => (
                <article
                  key={role.id}
                  className="rounded-2xl border-2 border-[#c1c9c0]/40 bg-[#fbf9f1]/50 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#356647]/15 text-[#356647]">
                      <span className="material-symbols-outlined text-[32px]">badge</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold text-[#1b1c17]">{formatRoleName(role.roleName)}</h3>
                      <p className="mt-1 text-sm text-[#414942]">Mã hệ thống: {role.roleName}</p>
                      {formatRoleDescription(role.roleName, role.description) ? (
                        <p className="mt-2 text-base text-[#414942]">
                          {formatRoleDescription(role.roleName, role.description)}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(role.permissions || []).length ? (
                          role.permissions.map((perm) => (
                            <span
                              key={perm}
                              className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#356647] ring-1 ring-[#356647]/20"
                            >
                              {formatPermissionName(perm)}
                            </span>
                          ))
                        ) : (
                          <span className="text-base text-[#717971]">Chưa gán quyền nào</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <BigButton variant="secondary" className="flex-1 sm:flex-none" onClick={() => openEditRole(role)}>
                      Sửa vai trò
                    </BigButton>
                    <BigButton variant="danger" className="flex-1 sm:flex-none" onClick={() => handleSoftDeleteRole(role)}>
                      Ngừng sử dụng
                    </BigButton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-[24px] border-2 border-[#c1c9c0]/40 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-[#356647]">
                {view === 'restore' ? 'Khôi phục quyền thao tác' : 'Danh sách quyền thao tác'}
              </h2>
              {view === 'active' ? (
                <BigButton onClick={() => setPermissionModalOpen(true)}>
                  <span className="material-symbols-outlined text-[24px]">add</span>
                  Thêm quyền
                </BigButton>
              ) : null}
            </div>
            <ViewTabs view={view} onViewChange={setView} restoreCount={deletedPermissions.length} />
          </div>

          <div className="relative mb-6 max-w-xl">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[24px] text-[#414942]">search</span>
            <input
              className="w-full rounded-2xl border-2 border-[#c1c9c0] py-4 pl-12 pr-4 text-base outline-none focus:border-[#356647]"
              placeholder="Gõ tên quyền để tìm..."
              value={permissionSearch}
              onChange={(e) => setPermissionSearch(e.target.value)}
            />
          </div>

          {view === 'restore' ? (
            isLoading ? (
              <p className="py-8 text-center text-lg text-[#414942]">Đang tải dữ liệu...</p>
            ) : filteredDeletedPermissions.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#c1c9c0] bg-[#fbf9f1] py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-[#717971]">inventory_2</span>
                <p className="mt-3 text-lg font-semibold text-[#414942]">Chưa có quyền cần khôi phục</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredDeletedPermissions.map((permission) => (
                  <article
                    key={permission.id}
                    className="flex flex-col rounded-2xl border-2 border-[#717971]/30 bg-[#f6f4ec] p-5"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-[#414942]">
                        {formatPermissionName(permission.permissionName)}
                      </h3>
                      <p className="mt-1 text-sm text-[#717971]">Mã: {permission.permissionName}</p>
                    </div>
                    <BigButton variant="secondary" className="mt-4 w-full" onClick={() => handleRestorePermission(permission)}>
                      <span className="material-symbols-outlined text-[24px]">restore</span>
                      Khôi phục
                    </BigButton>
                  </article>
                ))}
              </div>
            )
          ) : isLoading ? (
            <p className="py-8 text-center text-lg text-[#414942]">Đang tải dữ liệu...</p>
          ) : filteredPermissions.length === 0 ? (
            <p className="py-8 text-center text-lg text-[#414942]">Không tìm thấy quyền nào.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPermissions.map((permission) => (
                <article
                  key={permission.id}
                  className="flex flex-col rounded-2xl border-2 border-[#c1c9c0]/40 bg-[#fbf9f1]/50 p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[36px] text-[#356647]">key</span>
                    <div>
                      <h3 className="text-lg font-bold text-[#1b1c17]">
                        {formatPermissionName(permission.permissionName)}
                      </h3>
                      <p className="mt-1 text-sm text-[#717971]">Mã: {permission.permissionName}</p>
                      <p className="mt-2 text-base text-[#414942]">{getPermissionHint(permission.permissionName)}</p>
                    </div>
                  </div>
                  <BigButton
                    variant="danger"
                    className="mt-4 w-full"
                    onClick={() => handleSoftDeletePermission(permission)}
                  >
                    Ngừng sử dụng
                  </BigButton>
                </article>
              ))}
            </div>
          )}

          {view === 'active' ? (
            <p className="mt-6 text-base text-[#414942]">Tổng cộng {permissions.length} quyền đang hoạt động.</p>
          ) : null}
        </section>
      )}

      {roleModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold text-[#356647]">
              {editingRoleId ? 'Sửa vai trò' : 'Thêm vai trò mới'}
            </h2>
            <p className="mt-2 text-base text-[#414942]">Điền thông tin và chọn các quyền phù hợp.</p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-base font-bold text-[#1b1c17]">Tên vai trò (mã hệ thống)</span>
                <input
                  className="mt-2 w-full rounded-2xl border-2 border-[#c1c9c0] px-4 py-3 text-base"
                  placeholder="Ví dụ: SalePos, Warehouse"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm((p) => ({ ...p, roleName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-base font-bold text-[#1b1c17]">Mô tả (tiếng Việt)</span>
                <input
                  className="mt-2 w-full rounded-2xl border-2 border-[#c1c9c0] px-4 py-3 text-base"
                  placeholder="Ví dụ: Nhân viên bán hàng tại quầy"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>

              <fieldset>
                <legend className="text-base font-bold text-[#1b1c17]">Chọn quyền cho vai trò này</legend>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {permissions.map((permission) => {
                    const checked = roleForm.permissionIds.includes(permission.id)
                    return (
                      <label
                        key={permission.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${
                          checked ? 'border-[#356647] bg-[#356647]/10' : 'border-[#c1c9c0]/60 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0"
                          checked={checked}
                          onChange={() => toggleRolePermission(permission.id)}
                        />
                        <span>
                          <span className="block text-base font-bold text-[#1b1c17]">
                            {formatPermissionName(permission.permissionName)}
                          </span>
                          <span className="mt-1 block text-sm text-[#414942]">
                            {getPermissionHint(permission.permissionName)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <BigButton variant="secondary" onClick={() => setRoleModalOpen(false)}>Hủy bỏ</BigButton>
              <BigButton disabled={isSavingRole} onClick={handleSaveRole}>
                {isSavingRole ? 'Đang lưu...' : 'Lưu lại'}
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}

      {permissionModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold text-[#356647]">Thêm quyền mới</h2>
            <p className="mt-2 text-base text-[#414942]">
              Nhập mã quyền bằng chữ in hoa, gạch dưới. Ví dụ: <strong>TAO_DON</strong>
            </p>
            <label className="mt-6 block">
              <span className="text-base font-bold text-[#1b1c17]">Mã quyền</span>
              <input
                className="mt-2 w-full rounded-2xl border-2 border-[#c1c9c0] px-4 py-3 text-base uppercase"
                placeholder="TAO_DON"
                value={permissionFormName}
                onChange={(e) => setPermissionFormName(e.target.value)}
              />
            </label>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <BigButton variant="secondary" onClick={() => setPermissionModalOpen(false)}>Hủy bỏ</BigButton>
              <BigButton disabled={isSavingPermission} onClick={handleCreatePermission}>
                {isSavingPermission ? 'Đang lưu...' : 'Thêm quyền'}
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}

      {guideOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#717971]">Hỗ trợ sử dụng</p>
                <h2 className="mt-1 text-2xl font-bold text-[#356647]">Hướng dẫn nhanh</h2>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
                onClick={() => setGuideOpen(false)}
                title="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5">
              <InfoBox>
                <ul className="list-inside list-disc space-y-2">
                  <li><strong>Vai trò</strong> là nhóm công việc (ví dụ: Nhân viên bán hàng, Thủ kho).</li>
                  <li><strong>Quyền</strong> là việc được phép làm (ví dụ: Tạo đơn hàng, Xem khách hàng).</li>
                  <li>Gán quyền vào vai trò → rồi gán vai trò cho nhân viên ở mục <strong>Tài khoản</strong> hoặc <strong>Nhân sự</strong>.</li>
                  <li>Mỗi mục có 2 tab: <strong>Đang sử dụng</strong> và <strong>Khôi phục</strong>.</li>
                  <li>Nút <strong>Ngừng sử dụng</strong> chuyển sang tab Khôi phục — bấm <strong>Khôi phục</strong> để dùng lại.</li>
                </ul>
              </InfoBox>
            </div>

            <div className="mt-6 flex justify-end">
              <BigButton onClick={() => setGuideOpen(false)}>Đã hiểu</BigButton>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default AccessControlPage
