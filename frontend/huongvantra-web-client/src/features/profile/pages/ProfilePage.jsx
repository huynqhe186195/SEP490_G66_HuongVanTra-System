import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { fetchMyProfile, updateMyProfile } from '../services/profileApi.js'

const EMPTY_FORM = {
  fullName: '',
  username: '',
  phone: '',
  role: '',
  note: '',
  currentPassword: '',
  newPassword: '',
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  function handleChange(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  useEffect(() => {
    let mounted = true
    let autofillGuardTimer = null

    async function loadProfile() {
      try {
        const profile = await fetchMyProfile()
        if (!mounted) return
        const phoneFromApi = profile.phone || ''
        setForm({
          ...EMPTY_FORM,
          fullName: profile.fullName || '',
          username: profile.username || '',
          phone: phoneFromApi,
          role: (profile.roles || []).join(', '),
          note: profile.note || '',
        })
        // Chrome hay autofill username vào ô tel sau paint khi có field password gần đó.
        autofillGuardTimer = window.setTimeout(() => {
          if (!mounted) return
          setForm((current) => {
            const username = current.username || ''
            if (!username) return current
            if (current.phone === username && phoneFromApi !== username) {
              return { ...current, phone: phoneFromApi }
            }
            return current
          })
        }, 100)
      } catch (error) {
        showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadProfile()
    return () => {
      mounted = false
      if (autofillGuardTimer) window.clearTimeout(autofillGuardTimer)
    }
  }, [])

  const canSubmit = useMemo(() => {
    if (!form.fullName.trim()) return false
    if (form.newPassword && !form.currentPassword) return false
    return true
  }, [form.fullName, form.newPassword, form.currentPassword])

  const passwordHint = useMemo(() => {
    if (form.newPassword && !form.currentPassword) {
      return 'Nhập mật khẩu hiện tại để xác nhận đổi mật khẩu.'
    }
    return ''
  }, [form.newPassword, form.currentPassword])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) {
      showError(passwordHint || 'Vui lòng nhập họ và tên.')
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateMyProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        note: form.note,
        currentPassword: form.currentPassword || null,
        newPassword: form.newPassword || null,
      })

      setForm((current) => ({
        ...current,
        fullName: updated.fullName || current.fullName,
        phone: updated.phone || '',
        note: updated.note || '',
        role: (updated.roles || []).join(', ') || current.role,
        currentPassword: '',
        newPassword: '',
      }))
      showSuccess(form.newPassword ? 'Đã lưu hồ sơ và đổi mật khẩu.' : 'Đã lưu hồ sơ cá nhân.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border-none bg-[#f6f4ec] p-3 text-sm text-[#1b1c17] shadow-inner outline-none transition focus:ring-2 focus:ring-[#356647]/30 disabled:bg-[#eae8e0] disabled:text-[#717971]'

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Hồ sơ cá nhân"
        titleInfo="Cập nhật thông tin liên hệ và mật khẩu đăng nhập."
        rightContent={(
          <button
            type="submit"
            form="profile-form"
            disabled={isLoading || isSaving || !canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4a6242] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        )}
      />

      {isLoading ? (
        <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-10 shadow-sm">
          <p className="text-center text-sm text-[#717971]">Đang tải hồ sơ...</p>
        </section>
      ) : (
        <form id="profile-form" className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
          <section className="overflow-hidden rounded-[24px] border border-[#c1c9c0]/30 bg-white shadow-sm">
            <div className="flex flex-col gap-4 bg-gradient-to-r from-[#356647]/10 via-[#fbf9f1] to-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#356647] text-lg font-bold text-white shadow-sm"
                  aria-hidden
                >
                  {getInitials(form.fullName || form.username)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-[#1b1c17]">
                    {form.fullName.trim() || form.username || 'Tài khoản'}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-[#717971]">@{form.username || '—'}</p>
                </div>
              </div>
              {form.role ? (
                <span className="inline-flex w-fit max-w-full truncate rounded-full bg-[#356647]/10 px-3 py-1 text-xs font-semibold text-[#356647]">
                  {form.role}
                </span>
              ) : null}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm xl:col-span-3 lg:p-7">
              <div className="mb-5 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">badge</span>
                <h3 className="text-lg font-semibold">Thông tin cá nhân</h3>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Họ và tên</span>
                  <input
                    className={inputClass}
                    type="text"
                    name="fullName"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                    required
                    maxLength={200}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Tên đăng nhập</span>
                  {/* Không dùng disabled: Chrome bỏ qua field đó rồi đổ username vào ô SĐT gần password. */}
                  <input
                    className={inputClass}
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={form.username}
                    readOnly
                    tabIndex={-1}
                    title="Tên đăng nhập do quản trị viên quản lý"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Số điện thoại</span>
                  <input
                    className={inputClass}
                    type="tel"
                    name="employeePhone"
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Ghi chú</span>
                  <textarea
                    className={`${inputClass} min-h-[96px] resize-y`}
                    name="note"
                    autoComplete="off"
                    rows={3}
                    value={form.note}
                    onChange={handleChange('note')}
                    maxLength={500}
                    placeholder="Không bắt buộc"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm xl:col-span-2 lg:p-7">
              <div className="mb-2 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">lock</span>
                <h3 className="text-lg font-semibold">Đổi mật khẩu</h3>
              </div>
              <p className="mb-5 text-sm text-[#717971]">Để trống nếu không muốn đổi mật khẩu.</p>

              <div className="grid grid-cols-1 gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Mật khẩu hiện tại</span>
                  <input
                    className={inputClass}
                    type="password"
                    name="currentPassword"
                    value={form.currentPassword}
                    onChange={handleChange('currentPassword')}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Mật khẩu mới</span>
                  <input
                    className={inputClass}
                    type="password"
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange('newPassword')}
                    autoComplete="new-password"
                    placeholder="Ít nhất 6 ký tự"
                  />
                </label>
                {passwordHint ? (
                  <p className="text-sm text-amber-800">{passwordHint}</p>
                ) : null}
              </div>
            </section>
          </div>
        </form>
      )}
    </PageShell>
  )
}

export default ProfilePage
