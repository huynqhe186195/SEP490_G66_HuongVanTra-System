import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  createStaffAccount,
  fetchRoleOptions,
} from '../services/staffApi.js'
import {
  getPhoneMaxLength,
  normalizePhoneInput,
  validateAccountPhone,
} from '../../iam/utils/accountValidation.js'

function StaffCreatePage() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState([])

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    password: '',
    note: '',
    roles: [],
    scope: 'co-ban',
    active: true,
  })

  useEffect(() => {
    let mounted = true
    const loadRoles = async () => {
      try {
        const roles = await fetchRoleOptions()
        if (!mounted) return
        setRoleOptions(roles || [])
      } catch (error) {
        showError(error.message)
      }
    }
    loadRoles()
    return () => { mounted = false }
  }, [])

  const handleChange = (field) => (event) => {
    const value = field === 'phone'
      ? normalizePhoneInput(event.target.value)
      : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleRole = (roleName) => {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(roleName)
        ? current.roles.filter((role) => role !== roleName)
        : [...current.roles, roleName],
    }))
  }

  const canSubmit = useMemo(
    () => Boolean(form.fullName.trim() && form.phone.trim() && form.username.trim() && form.password.trim().length >= 6 && form.roles.length),
    [form.fullName, form.phone, form.username, form.password, form.roles.length],
  )

  const handleSave = async () => {
    if (!canSubmit) {
      showError('Vui lòng nhập đủ họ tên, số điện thoại, tên đăng nhập, mật khẩu (≥6) và vai trò.')
      return
    }

    const phoneError = validateAccountPhone(form.phone, { required: true })
    if (phoneError) {
      showError(phoneError)
      return
    }

    setIsSaving(true)
    try {
      await createStaffAccount({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password,
        phone: form.phone.trim(),
        note: form.note.trim() || null,
        isActive: form.active,
        roles: form.roles,
      })
      showSuccess('Tạo tài khoản nhân viên thành công.')
      navigate('/staff')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Tạo nhân viên"
        titleInfo="Thêm tài khoản nhân sự mới, gán vai trò và phạm vi sử dụng"
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#414942]">
            <span>Hệ thống</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span>Nhân viên</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Thêm mới</span>
          </nav>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold text-[#356647]">Thêm tài khoản nhân sự</h1>
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
                disabled={isSaving || !canSubmit}
              >
                {isSaving ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">person</span>
                <h3 className="text-xl font-semibold">Thông tin cá nhân</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Họ và tên</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.fullName} onChange={handleChange('fullName')} />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Số điện thoại</span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={getPhoneMaxLength(form.phone)}
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="Di động 10 số hoặc máy bàn 02… (11 số)"
                  />
                  <span className="text-xs text-[#717971]">
                    Di động: 10 số. Máy bàn: 11 số bắt đầu bằng 02.
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Tên đăng nhập</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.username} onChange={handleChange('username')} />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Mật khẩu</span>
                  <input type="password" className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.password} onChange={handleChange('password')} />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Ghi chú</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.note} onChange={handleChange('note')} />
                </label>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <h3 className="text-xl font-semibold">Gán quyền</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <fieldset className="flex flex-col gap-2 md:col-span-2">
                  <legend className="text-xs font-semibold text-[#414942]">Vai trò nhân viên (có thể chọn nhiều)</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roleOptions.map((role) => (
                      <label key={role.id} className="flex items-center gap-3 rounded-lg bg-[#f6f4ec] p-3 text-sm shadow-inner">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#356647]"
                          checked={form.roles.includes(role.name)}
                          onChange={() => toggleRole(role.name)}
                        />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

              
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#356647]">
                  <span className="material-symbols-outlined">online_prediction</span>
                  <h3 className="text-xl font-semibold">Trạng thái hệ thống</h3>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${form.active ? 'text-[#356647]' : 'text-[#414942]'}`}>{form.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                  <button type="button" className={`relative h-6 w-12 rounded-full transition-colors ${form.active ? 'bg-[#356647]' : 'bg-[#dcdad2]'}`} onClick={() => setForm((current) => ({ ...current, active: !current.active }))} aria-label="Toggle status">
                    <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </section>
          </div>

          
        </div>
      </section>
    </div>
  )
}

export default StaffCreatePage
