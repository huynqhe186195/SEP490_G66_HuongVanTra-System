import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../features/auth/services/authApi.js'
import {
  clearAuthSession,
  formatDisplayName,
  loadAuthSession,
} from '../../features/auth/services/authSession.js'
import { canAccessModule, isNavigationItemActive } from '../../app/navigation.js'
import { showError } from '../../app/toast'

function Sidebar({ items, isLoading = false, mobileOpen = false, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const authSession = loadAuthSession()
  const userLabel =
    formatDisplayName(authSession?.username) || 'Admin'

  const handleLogout = async () => {
    if (!authSession) {
      clearAuthSession()
      navigate('/login', { replace: true })
      return
    }

    setIsLoggingOut(true)

    try {
      await logoutApi(
        authSession.accessToken,
        authSession.refreshToken,
      )
    } catch {
      // Always clear the local session and return to login.
    } finally {
      clearAuthSession()
      setIsLoggingOut(false)

      navigate('/login', { replace: true })
    }
  }

  const closeMobileNav = () => {
    onNavigate?.()
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-2rem,17rem)] max-w-[85vw] flex-col rounded-none bg-[#538463] p-4 text-white shadow-[0_12px_40px_rgba(36,64,48,0.18)] transition-transform duration-300 ease-out lg:static lg:z-auto lg:m-4 lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-[32px] lg:p-5 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
      aria-hidden={!mobileOpen ? undefined : false}
    >
      <div className="mb-6 flex items-center justify-between gap-3 px-1 lg:mb-8 lg:px-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8f6ef] shadow-inner lg:h-12 lg:w-12">
            <div className="h-6 w-6 rounded-xl bg-[#A7C49E] lg:h-7 lg:w-7" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-wide">
              Hương Vân Trà
            </h1>

            <p className="text-xs text-white/60">
              Tea Management
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden"
          aria-label="Đóng menu"
          onClick={closeMobileNav}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="px-4 py-2 text-sm text-white/70">
            Đang tải menu...
          </p>
        ) : null}

        {items.map((item) => {
          const itemActive = isNavigationItemActive(location.pathname, item)

          return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(e) => {
              try {
                const session = loadAuthSession()

                const allowed = canAccessModule(
                  session,
                  item.module,
                )

                if (!allowed) {
                  e.preventDefault()

                  showError(
                    'Bạn không có quyền truy cập tab này.',
                  )
                  return
                }
              } catch {
                // fallback: allow navigation
              }

              closeMobileNav()
            }}
            className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200 ${
              itemActive
                ? 'bg-[#A7C49E] font-semibold text-[#538463] shadow-md'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full transition-all ${
                itemActive
                  ? 'bg-[#538463]'
                  : 'bg-white/30 group-hover:bg-white/60'
              }`}
            />

            <span className="truncate">
              {item.label}
            </span>
          </NavLink>
          )
        })}
      </nav>

      <div className="mt-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 backdrop-blur-sm lg:mt-6">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A7C49E] text-lg font-bold text-[#538463] shadow-lg lg:h-12 lg:w-12">
              {userLabel.charAt(0).toUpperCase()}
            </div>

            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#538463] bg-green-400" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/50">
              Xin chào 👋
            </p>

            <p className="truncate text-sm font-semibold text-white">
              {userLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <NavLink
            to="/profile"
            onClick={closeMobileNav}
            className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]">
              manage_accounts
            </span>

            <span className="flex-1">
              Chỉnh sửa hồ sơ
            </span>

            <span className="material-symbols-outlined text-[18px] opacity-50">
              chevron_right
            </span>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-2xl bg-[#A7C49E] px-4 py-3 text-sm font-semibold text-[#538463] transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>

            <span className="flex-1 text-left">
              {isLoggingOut
                ? 'Đang thoát...'
                : 'Đăng xuất'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
