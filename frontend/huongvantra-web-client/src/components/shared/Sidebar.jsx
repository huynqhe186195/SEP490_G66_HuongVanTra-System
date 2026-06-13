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

function Sidebar({
  items,
  isLoading = false,
  mobileOpen = false,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const authSession = loadAuthSession()
  const userLabel = formatDisplayName(authSession?.username) || 'Quản trị'
  const isCompact = collapsed

  const handleLogout = async () => {
    if (!authSession) {
      clearAuthSession()
      navigate('/login', { replace: true })
      return
    }

    setIsLoggingOut(true)

    try {
      await logoutApi(authSession.accessToken, authSession.refreshToken)
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

  const navLinkClass = (active) =>
    [
      'group flex items-center rounded-2xl text-sm transition-all duration-200',
      isCompact ? 'h-11 w-full justify-center px-0' : 'gap-3 px-4 py-3',
      active
        ? 'bg-[#A7C49E] font-semibold text-[#538463] shadow-md'
        : 'text-white/80 hover:bg-white/10 hover:text-white',
    ].join(' ')

  const handleNavClick = (event, module) => {
    try {
      const session = loadAuthSession()
      if (!canAccessModule(session, module)) {
        event.preventDefault()
        showError('Bạn không có quyền truy cập tab này.')
        return
      }
    } catch {
      // fallback: allow navigation
    }
    closeMobileNav()
  }

  return (
    <aside
      className={[
        'relative z-50 flex shrink-0 flex-col overflow-hidden bg-[#538463] text-white shadow-[0_12px_40px_rgba(36,64,48,0.18)] transition-[width,transform,padding] duration-300 ease-out',
        'fixed inset-y-0 left-0 rounded-none lg:static lg:z-auto lg:m-4 lg:translate-x-0 lg:rounded-[32px]',
        isCompact
          ? 'w-[min(100vw-2rem,5.25rem)] p-3 lg:w-[5.25rem]'
          : 'w-[min(100vw-2rem,17rem)] max-w-[85vw] p-4 lg:w-64 lg:p-5',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
      aria-expanded={!isCompact}
    >
      {/* Header */}
      <div
        className={`shrink-0 border-b border-white/10 ${isCompact ? 'mb-3 pb-3' : 'mb-5 pb-4 lg:mb-6'}`}
      >
        {isCompact ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex w-full justify-end">
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25 lg:inline-flex"
                aria-label="Mở rộng menu"
                title="Mở rộng menu"
                onClick={onToggleCollapsed}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8f6ef] shadow-inner"
              title="Hương Vân Trà"
            >
              <div className="h-5 w-5 rounded-lg bg-[#A7C49E]" />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8f6ef] shadow-inner lg:h-12 lg:w-12">
                <div className="h-6 w-6 rounded-xl bg-[#A7C49E] lg:h-7 lg:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-bold tracking-wide">Hương Vân Trà</h1>
                <p className="truncate text-xs text-white/60">Tea Management</p>
              </div>
            </div>

            <button
              type="button"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25 lg:inline-flex"
              aria-label="Thu gọn menu"
              title="Thu gọn menu"
              onClick={onToggleCollapsed}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden"
              aria-label="Đóng menu"
              onClick={closeMobileNav}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto">
        {isLoading ? (
          <p className={`py-2 text-sm text-white/70 ${isCompact ? 'text-center' : 'px-4'}`}>
            {isCompact ? '…' : 'Đang tải menu...'}
          </p>
        ) : null}

        {items.map((item) => {
          const itemActive = isNavigationItemActive(location.pathname, item, location.search)
          const iconName = item.icon || 'circle'

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={isCompact ? item.label : undefined}
              onClick={(event) => handleNavClick(event, item.module)}
              className={navLinkClass(itemActive)}
            >
              {isCompact ? (
                <span
                  className={`material-symbols-outlined text-[22px] leading-none ${
                    itemActive ? 'text-[#538463]' : 'text-white/90'
                  }`}
                >
                  {iconName}
                </span>
              ) : (
                <>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full transition-all ${
                      itemActive ? 'bg-[#538463]' : 'bg-white/30 group-hover:bg-white/60'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className={`shrink-0 border-t border-white/10 ${isCompact ? 'mt-3 space-y-1 pt-3' : 'mt-4 space-y-2 pt-4 lg:mt-6'}`}
      >
        {!isCompact ? (
          <div className="mb-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A7C49E] text-lg font-bold text-[#538463] shadow-lg lg:h-12 lg:w-12">
                  {userLabel.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#538463] bg-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/50">Xin chào 👋</p>
                <p className="truncate text-sm font-semibold text-white">{userLabel}</p>
              </div>
            </div>
          </div>
        ) : null}

        <NavLink
          to="/profile"
          title={isCompact ? 'Chỉnh sửa hồ sơ' : undefined}
          onClick={closeMobileNav}
          className={`flex items-center rounded-2xl bg-white/5 text-sm text-white/80 transition-all hover:bg-white/10 hover:text-white ${
            isCompact ? 'h-11 w-full justify-center px-0' : 'gap-3 px-4 py-3'
          }`}
        >
          <span className="material-symbols-outlined shrink-0 text-[20px] leading-none">
            manage_accounts
          </span>
          {!isCompact ? (
            <>
              <span className="min-w-0 flex-1 truncate">Chỉnh sửa hồ sơ</span>
              <span className="material-symbols-outlined shrink-0 text-[18px] opacity-50">chevron_right</span>
            </>
          ) : null}
        </NavLink>

        <button
          type="button"
          title={isCompact ? (isLoggingOut ? 'Đang thoát...' : 'Đăng xuất') : undefined}
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex w-full items-center rounded-2xl bg-[#A7C49E] text-sm font-semibold text-[#538463] transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${
            isCompact ? 'h-11 justify-center px-0' : 'gap-3 px-4 py-3'
          }`}
        >
          <span className="material-symbols-outlined shrink-0 text-[20px] leading-none">logout</span>
          {!isCompact ? (
            <span className="min-w-0 flex-1 truncate text-left">
              {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
