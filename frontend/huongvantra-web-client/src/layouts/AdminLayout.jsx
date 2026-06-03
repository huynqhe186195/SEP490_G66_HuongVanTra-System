import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import ModuleRouteGuard from '../app/ModuleRouteGuard.jsx'
import Sidebar from '../components/shared/Sidebar.jsx'
import { getNavigationItemsForSession } from '../app/navigation.js'
import { enrichSessionWithAccess } from '../features/auth/services/authApi.js'
import { loadAuthSession, saveAuthSession } from '../features/auth/services/authSession.js'

const SIDEBAR_COLLAPSED_KEY = 'hvt-sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function AdminLayout() {
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [sidebarItems, setSidebarItems] = useState(() => getNavigationItemsForSession(loadAuthSession()))
  const [isLoadingAccess, setIsLoadingAccess] = useState(() => !loadAuthSession()?.modules?.length)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const location = useLocation()

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  useEffect(() => {
    let isMounted = true

    const syncAccess = async () => {
      const session = loadAuthSession()
      if (!session) {
        return
      }

      if (session.modules?.length) {
        if (isMounted) {
          setSidebarItems(getNavigationItemsForSession(session))
          setIsLoadingAccess(false)
        }
        return
      }

      if (isMounted) {
        setIsLoadingAccess(true)
      }

      try {
        const enrichedSession = await enrichSessionWithAccess(session)
        saveAuthSession(enrichedSession)

        if (isMounted) {
          setAuthSession(enrichedSession)
          setSidebarItems(getNavigationItemsForSession(enrichedSession))
        }
      } catch {
        if (isMounted) {
          setSidebarItems(getNavigationItemsForSession(session))
        }
      } finally {
        if (isMounted) {
          setIsLoadingAccess(false)
        }
      }
    }

    void syncAccess()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavOpen])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  if (!authSession) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-gray-800">
      <div className="flex h-[100dvh] overflow-hidden">
        {mobileNavOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Đóng menu"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <Sidebar
          items={sidebarItems}
          isLoading={isLoadingAccess}
          mobileOpen={mobileNavOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center gap-3 border-b border-[#c1c9c0]/50 bg-[#fbf9f1] px-3 py-3 lg:hidden">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#c1c9c0]/80 bg-white text-[#356647] shadow-sm"
              aria-label="Mở menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#1b1c17]">Hương Vân Trà</p>
              <p className="truncate text-xs text-[#717971]">Quản trị hệ thống</p>
            </div>
          </header>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 lg:p-6 xl:p-8">
            <ModuleRouteGuard session={authSession} isLoadingAccess={isLoadingAccess}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Outlet />
              </div>
            </ModuleRouteGuard>
          </main>
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
