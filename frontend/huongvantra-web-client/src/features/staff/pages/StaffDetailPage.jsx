import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { fetchRoleOptions, fetchStaffAccount, updateStaffAccount } from '../services/staffApi.js'

const loginHistory = [
  { id: '1', channel: 'He thong POS 02', time: '14:20', date: 'Lan cuoi: Hom nay', icon: 'devices', active: true },
  { id: '2', channel: 'Mobile App', time: '08:15', date: 'Lan cuoi: Hom qua', icon: 'smartphone', active: false },
]

function StaffDetailPage() {
  const navigate = useNavigate()
  const { id: employeeId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState([])
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    employeeCode: '',
    role: '',
    note: '',
    newPassword: '',
    active: true,
  })

  useEffect(() => {
    if (!employeeId) {
      showError('ID nhân viên không hợp lệ.')
      setIsLoading(false)
      return
    }

    let mounted = true
    const loadData = async () => {
      try {
        const [account, roles] = await Promise.all([fetchStaffAccount(employeeId), fetchRoleOptions()])
        if (!mounted) return

        setRoleOptions(roles || [])
        setForm({
          fullName: account.fullName || '',
          phone: account.phone || '',
          username: account.username || '',
          employeeCode: account.employeeCode || '',
          role: account.roles?.[0] || '',
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
    if (!form.active) return true
    return Boolean(form.fullName.trim() && form.phone.trim() && form.username.trim())
  }, [form.active, form.fullName, form.phone, form.username])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSave = async () => {
    if (!employeeId) return

    const isDeactivating = !form.active

    if (!isDeactivating) {
      if (!canSave) {
        showError('Vui lòng nhập đủ họ tên, số điện thoại và tên đăng nhập.')
        return
      }
      if (!form.role) {
        showError('Vui lòng chọn vai trò nhân viên.')
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
        role: form.role || undefined,
        newPassword: isDeactivating ? null : form.newPassword || null,
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
        description="Xem và chỉnh sửa thông tin tài khoản, quyền truy cập và lịch sử đăng nhập"
        searchPlaceholder="Tìm kiếm hệ thống..."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#414942]">
            <span>He thong</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span>Nhan vien</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Chi tiet</span>
          </nav>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold text-[#356647]">Chi tiết &amp; chỉnh sửa nhân viên</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-[#356647] px-6 py-2 text-[#356647] transition-all hover:bg-[#356647]/5 active:scale-95"
                onClick={() => navigate('/staff')}
              >
                Huy bo
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#4a6242] px-6 py-2 text-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                onClick={handleSave}
                disabled={isLoading || isSaving || !canSave}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">person</span>
                <h3 className="text-xl font-semibold">Thong tin ca nhan</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Ho va ten</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">So dien thoai</span>
                  <input
                    required
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.phone}
                    onChange={handleChange('phone')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Tên đăng nhập</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.username}
                    onChange={handleChange('username')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Mat khau moi</span>
                  <input
                    type="password"
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.newPassword}
                    onChange={handleChange('newPassword')}
                    placeholder="Để trống nếu không đổi"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Ghi chu</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.note}
                    onChange={handleChange('note')}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <h3 className="text-xl font-semibold">Gán quyền</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Vai tro nhan vien</span>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                      value={form.role}
                      onChange={handleChange('role')}
                    >
                      <option value="">Chọn vai trò</option>
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                </label>

          
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#356647]">
                  <span className="material-symbols-outlined">online_prediction</span>
                  <h3 className="text-xl font-semibold">Trang thai he thong</h3>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${form.active ? 'text-[#356647]' : 'text-[#414942]'}`}>{form.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                  <button
                    type="button"
                    className={`relative h-6 w-12 rounded-full transition-colors ${form.active ? 'bg-[#356647]' : 'bg-[#dcdad2]'}`}
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    aria-label="Toggle status"
                  >
                    <span
                      className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              </div>
            </section>
          </div>

         
        </div>
      </section>
    </PageShell>
  )
}

export default StaffDetailPage