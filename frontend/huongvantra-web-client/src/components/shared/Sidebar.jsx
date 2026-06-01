import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../features/auth/services/authApi.js'
import { clearAuthSession, formatDisplayName, loadAuthSession } from '../../features/auth/services/authSession.js'
import { canAccessModule } from '../../app/navigation.js'
import { showError } from '../../app/toast'

function Sidebar({ items, isLoading = false }) {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const authSession = loadAuthSession()
  const userLabel = formatDisplayName(authSession?.username) || 'Admin'

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

  return (
    <aside className="m-4 flex w-64 shrink-0 flex-col rounded-3xl bg-[#538463] p-6 text-white shadow-[0_12px_40px_rgba(36,64,48,0.18)]">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50">
          <div className="h-8 w-8 rounded-lg bg-[#A7C49E]" />
        </div>
        <div>
          <h1 className="text-sm font-bold">Hương Vân Trà</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="px-4 py-2 text-sm text-white/70">Dang tai menu...</p>
        ) : null}
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(e) => {
              try {
                const session = loadAuthSession()
                const allowed = canAccessModule(session, item.module)
                if (!allowed) {
                  e.preventDefault()
                  showError('Bạn không có quyền truy cập tab này.')
                }
              } catch {
                // fallback: allow navigation
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                isActive ? 'bg-[#A7C49E] font-semibold text-[#538463] shadow-sm' : 'opacity-80 hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-[#538463]' : 'bg-white/40'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl bg-white/10 p-4">
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Dang nhap</p>
          <p className="mt-1 text-sm font-semibold text-white">{userLabel}</p>
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A7C49E] px-4 py-2.5 text-sm font-semibold text-[#538463] transition-colors hover:bg-[#b5d0ae] disabled:cursor-not-allowed disabled:opacity-70"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>{isLoggingOut ? 'Dang thoat...' : 'Dang xuat'}</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar