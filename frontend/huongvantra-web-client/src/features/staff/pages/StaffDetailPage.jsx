import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { getPhoneMaxLength, normalizePhoneInput } from '../../iam/utils/accountValidation.js'
import { fetchRoleOptions, fetchStaffAccount, normalizeStaffRolesForEdit, updateStaffAccount } from '../services/staffApi.js'

function StaffDetailPage() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const { id: employeeId } = useParams()
  const [isLoading, setIsLoading] = useState(Boolean(employeeId))
  const [isSaving, setIsSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState([])
  const [currentRoles, setCurrentRoles] = useState([])
  const [userGuid, setUserGuid] = useState(null)
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    employeeCode: '',
    note: '',
    newPassword: '',
    active: true,
  })

  const isOwnAccount = Boolean(
    userGuid
    && session?.userId
    && String(userGuid).toLowerCase() === String(session.userId).toLowerCase(),
  )

  useEffect(() => {
    if (!employeeId) {
      showError('ID nhân viên không hợp lệ.')
      return
    }

    let mounted = true
    const loadData = async () => {
      try {
        const [account, roles] = await Promise.all([
          fetchStaffAccount(employeeId),
          fetchRoleOptions(),
        ])
        if (!mounted) return

        setRoleOptions(roles || [])
        setCurrentRoles(normalizeStaffRolesForEdit(account.roles || [], roles || []))
        setUserGuid(account.userGuid || null)
        setForm({
          fullName: account.fullName || '',
          phone: account.phone || '',
          username: account.username || '',
          employeeCode: account.employeeCode || '',
          note: account.note || '',
          newPassword: '',
          active: Boolean(account.isActive),
        })
      } catch (error) {
        showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [employeeId])

  const canSave = useMemo(() => {
    if (!form.active) return !isOwnAccount
    return Boolean(form.fullName.trim() && form.username.trim() && currentRoles.length > 0)
  }, [form.active, form.fullName, form.username, currentRoles.length, isOwnAccount])

  const saveBlockedReason = useMemo(() => {
    if (!form.active && isOwnAccount) {
      return 'Không thể khóa chính tài khoản đang đăng nhập.'
    }
    if (!form.active) return ''
    if (!form.fullName.trim()) return 'Cần nhập họ tên.'
    if (!form.username.trim()) return 'Thiếu tên đăng nhập.'
    if (!currentRoles.length) return 'Cần chọn ít nhất một vai trò.'
    return ''
  }, [form.active, form.fullName, form.username, currentRoles.length, isOwnAccount])

  const handleChange = (field) => (event) => {
    const value = field === 'phone'
      ? normalizePhoneInput(event.target.value)
      : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleRole = (roleName) => {
    setCurrentRoles((current) => (
      current.includes(roleName)
        ? current.filter((role) => role !== roleName)
        : [...current, roleName]
    ))
  }

  const handleToggleActive = () => {
    if (isOwnAccount && form.active) {
      showError('Không thể khóa chính tài khoản đang đăng nhập.')
      return
    }
    setForm((current) => ({ ...current, active: !current.active }))
  }

  const handleSave = async () => {
    if (!employeeId) return

    const isDeactivating = !form.active

    if (isDeactivating && isOwnAccount) {
      showError('Không thể khóa chính tài khoản đang đăng nhập.')
      return
    }

    if (!isDeactivating) {
      if (!canSave) {
        showError(saveBlockedReason || 'Vui lòng nhập đủ họ tên và chọn vai trò.')
        return
      }
      const nextPassword = String(form.newPassword || '').trim()
      if (nextPassword && nextPassword.length < 8) {
        showError('Mật khẩu mới phải có ít nhất 8 ký tự.')
        return
      }
    }

    setIsSaving(true)
    try {
      await updateStaffAccount(employeeId, {
        fullName: form.fullName,
        phone: form.phone,
        note: form.note,
        username: form.username,
        isActive: form.active,
        newPassword: isDeactivating ? null : form.newPassword || null,
        roles: currentRoles,
      })

      showSuccess(isDeactivating ? 'Đã ngừng hoạt động nhân viên.' : 'Cập nhật nhân viên thành công.')
      navigate('/staff')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Chi tiết nhân viên"
        titleInfo="Xem và chỉnh sửa thông tin tài khoản nhân viên"
        searchPlaceholder="Tìm kiếm hệ thống..."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#414942]">
            <span>Hệ thống</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span>Nhân viên</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Chi tiết</span>
          </nav>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold text-[#356647]">Chi tiết &amp; chỉnh sửa nhân viên</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-[#356647] px-6 py-2 text-[#356647] transition-all hover:bg-[#356647]/5 active:scale-95"
                onClick={() => navigate('/staff')}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#4a6242] px-6 py-2 text-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                onClick={handleSave}
                disabled={isLoading || isSaving || !canSave}
                title={!canSave ? saveBlockedReason : undefined}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
            {saveBlockedReason ? (
              <p className="mt-2 text-sm text-amber-800">{saveBlockedReason}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">person</span>
                <h3 className="text-xl font-semibold">Thông tin cá nhân</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Họ và tên</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Số điện thoại (tuỳ chọn)</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={getPhoneMaxLength(form.phone)}
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="Di động 10 số hoặc máy bàn 02… (11 số)"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Tên đăng nhập</span>
                  <input
                    className="rounded-lg border-none bg-[#eae8e0] p-3 text-sm text-[#717971] shadow-inner outline-none"
                    value={form.username}
                    readOnly
                    title="Tên đăng nhập không đổi tại đây"
                  />
                </label>

                <fieldset className="flex flex-col gap-2 md:col-span-2">
                  <legend className="text-xs font-semibold text-[#414942]">Vai trò (có thể chọn nhiều)</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roleOptions.map((role) => (
                      <label key={role.id} className="flex items-center gap-3 rounded-lg bg-[#f6f4ec] p-3 text-sm shadow-inner">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#356647]"
                          checked={currentRoles.includes(role.name)}
                          onChange={() => toggleRole(role.name)}
                        />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Mật khẩu mới (≥8 ký tự)</span>
                  <input
                    type="password"
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.newPassword}
                    onChange={handleChange('newPassword')}
                    placeholder="Để trống nếu không đổi"
                    minLength={8}
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Ghi chú</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.note}
                    onChange={handleChange('note')}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[#356647]">
                  <span className="material-symbols-outlined">online_prediction</span>
                  <h3 className="text-xl font-semibold">Trạng thái hệ thống</h3>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${form.active ? 'text-[#356647]' : 'text-[#414942]'}`}>
                    {form.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </span>
                  <button
                    type="button"
                    className={`relative h-6 w-12 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${form.active ? 'bg-[#356647]' : 'bg-[#dcdad2]'}`}
                    onClick={handleToggleActive}
                    disabled={isOwnAccount && form.active}
                    title={isOwnAccount ? 'Không thể khóa chính tài khoản đang đăng nhập' : 'Đổi trạng thái hoạt động'}
                    aria-label="Đổi trạng thái hoạt động"
                  >
                    <span
                      className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              </div>
              {isOwnAccount ? (
                <p className="mt-3 text-sm text-amber-800">
                  Đây là tài khoản bạn đang đăng nhập — không thể tự khóa / ngừng hoạt động.
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

export default StaffDetailPage
