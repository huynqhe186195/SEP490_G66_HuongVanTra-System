import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { enrichSessionWithAccess, login } from '../services/authApi.js'
import { loadAuthSession, saveAuthSession } from '../services/authSession.js'
import { resolveHomeRoute } from '../../../app/navigation.js'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => localStorage.getItem('hv-remember-username') ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRemember(Boolean(localStorage.getItem('hv-remember-username')))
  }, [])

  useEffect(() => {
    const session = loadAuthSession()
    if (session) {
      navigate(resolveHomeRoute(session), { replace: true })
    }
  }, [navigate])

  const canSubmit = useMemo(() => username.trim() && password.trim() && !isSubmitting, [username, password, isSubmitting])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const authResult = await login(username.trim(), password)
      let session = authResult

      try {
        session = await enrichSessionWithAccess(authResult)
      } catch {
        // Fallback: sidebar uses roles from login response if access API is unavailable.
      }

      saveAuthSession(session)

      setSubmitSuccess(true)

      if (remember) {
        localStorage.setItem('hv-remember-username', username.trim())
      } else {
        localStorage.removeItem('hv-remember-username')
      }

      navigate(resolveHomeRoute(session), { replace: true })
    } catch (loginError) {
      setSubmitSuccess(false)
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbf9f1] p-6 [font-family:'Manrope',sans-serif]">
      <div className="absolute inset-0 z-0">
        <img
          alt="Tea plantation"
          className="h-full w-full object-cover opacity-30 grayscale-[20%] blur-sm"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBWyIgUhuaqJeGlKAvWRt7OgQtznBnXlrEPJZVoiFw-Aa648JlYoH0BTYIUceL-IOLHsYc5weGhEwPYVrUltCs4rO1RJ3mGXOomjGkfljpYrWue4EkiA6vTs_Z2nYX4Wpqnye_GhbSi-TcHrwugL5H_pcu-VW2wDw5R6L4uqOgHLKiPLnd84T_xIYJARaYJJ399Wv231jdgIT2oklTfsTq3wdyLXX_esTJociO9QTMJ4PjgCSLDwe4oJYv4mRAeHi91HlzeCfVIcl3"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#fbf9f1] via-transparent to-[#fbf9f1]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,#c1c9c0_1px,transparent_0)] [background-size:40px_40px] opacity-15" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
        <div className="rounded-xl border border-[#c1c9c0]/40 bg-white/90 p-10 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#4e7f5e]/10">
              <span className="material-symbols-outlined text-[40px] text-[#356647]">eco</span>
            </div>
            <h1 className="mb-1 text-2xl font-bold text-[#356647]">Hương Vân Trà</h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#414942]">Hệ thống Quản trị</p>
          </div>

          <div className="mb-8">
            <h2 className="mb-2 text-xl font-semibold text-[#1b1c17]">Đăng nhập hệ thống</h2>
            <p className="text-sm text-[#414942]">Vui lòng nhập thông tin để truy cập trình quản lý</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="ml-1 block text-xs font-semibold text-[#414942]">Tên đăng nhập</label>
              <div className="group relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#717971] transition-colors group-focus-within:text-[#356647]">person</span>
                <input
                  className="w-full rounded-lg border border-[#c1c9c0] bg-[#f6f4ec] py-3.5 pl-12 pr-4 text-base text-[#1b1c17] outline-none transition-all placeholder:text-[#717971]/60 focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Nhập tên đăng nhập"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 block text-xs font-semibold text-[#414942]">Mật khẩu</label>
              <div className="group relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#717971] transition-colors group-focus-within:text-[#356647]">lock</span>
                <input
                  className="w-full rounded-lg border border-[#c1c9c0] bg-[#f6f4ec] py-3.5 pl-12 pr-12 text-base text-[#1b1c17] outline-none transition-all placeholder:text-[#717971]/60 focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#717971] transition-colors hover:text-[#414942]"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-sm text-[#93000a]">{error}</div>
            ) : null}

            <div className="flex items-center justify-between">
              <label className="group flex cursor-pointer items-center gap-2">
                <input
                  className="h-5 w-5 cursor-pointer rounded border-[#c1c9c0] text-[#356647] focus:ring-[#356647]/20"
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="text-sm text-[#414942] transition-colors group-hover:text-[#1b1c17]">Ghi nhớ đăng nhập</span>
              </label>

              <Link className="text-xs font-semibold text-[#356647] transition-colors hover:text-[#1f5033] hover:underline" to="/forgot-password">
                Quên mật khẩu?
              </Link>
            </div>

            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#627b59] py-4 text-lg font-semibold text-[#f8ffef] shadow-md transition-all duration-200 hover:bg-[#5a7152] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  <span>Đang xử lý...</span>
                </>
              ) : submitSuccess ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Thành công</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 border-t border-[#c1c9c0]/30 pt-8">
            <p className="mb-4 text-center text-xs font-semibold text-[#414942]">Hỗ trợ kỹ thuật?</p>
            <div className="flex justify-center gap-4">
              <button type="button" className="rounded-full border border-[#c1c9c0]/30 bg-[#f0eee6] p-2.5 text-[#414942] transition-colors hover:bg-[#e4e3db]">
                <span className="material-symbols-outlined text-[20px]">support_agent</span>
              </button>
              <button type="button" className="rounded-full border border-[#c1c9c0]/30 bg-[#f0eee6] p-2.5 text-[#414942] transition-colors hover:bg-[#e4e3db]">
                <span className="material-symbols-outlined text-[20px]">mail</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[#414942]/70">
          <span>© 2026 Hương Vân Trà</span>
          <span className="h-1 w-1 rounded-full bg-[#717971]/50" />
          <span>v2.4.0</span>
        </div>
      </div>
    </div>
  )
}

export default LoginPage