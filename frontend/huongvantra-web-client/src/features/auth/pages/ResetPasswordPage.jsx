import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { resetPasswordWithToken } from '../services/authApi.js'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const resetToken = state?.resetToken || ''
  const maskedPhone = state?.maskedPhone || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!resetToken) {
      navigate('/forgot-password', { replace: true })
    }
  }, [resetToken, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (password !== confirm) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPasswordWithToken(resetToken, password)
      showSuccess('Đã đặt lại mật khẩu. Vui lòng đăng nhập.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Không đặt lại được mật khẩu.')
      showError(err.message || 'Không đặt lại được mật khẩu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f1] p-4 [font-family:'Manrope',sans-serif]">
      <main className="w-full max-w-[440px] rounded-2xl border border-[#c1c9c0]/40 bg-white p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
        <h1 className="mb-1 text-2xl font-bold text-[#356647]">Đặt mật khẩu mới</h1>
        <p className="mb-6 text-sm text-[#414942]">
          {maskedPhone ? (
            <>Tài khoản liên kết số <span className="font-semibold text-[#1b1c17]">{maskedPhone}</span></>
          ) : (
            'Nhập mật khẩu mới cho tài khoản của bạn.'
          )}
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#414942]">Mật khẩu mới</span>
            <input
              type="password"
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-4 text-sm outline-none focus:border-[#356647]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#414942]">Xác nhận mật khẩu</span>
            <input
              type="password"
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-4 text-sm outline-none focus:border-[#356647]"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-sm text-[#93000a]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4a6242] font-bold text-white hover:bg-[#627b59] disabled:opacity-60"
          >
            {isSubmitting ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link className="text-sm text-[#356647] hover:underline" to="/login">
            Quay lại đăng nhập
          </Link>
        </div>
      </main>
    </div>
  )
}

export default ResetPasswordPage
